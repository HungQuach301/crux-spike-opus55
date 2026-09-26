"""ITU-R BS.1770-4 loudness (K-weighting, gating) and 4x-oversampled true peak, in NumPy/SciPy."""
import numpy as np
import scipy.signal as sg

SR = 48000
# K-weighting at 48 kHz (BS.1770-4, table 1 and 2)
_SHELF = (np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]), np.array([1.0, -1.69065929318241, 0.73248077421585]))
_RLB = (np.array([1.0, -2.0, 1.0]), np.array([1.0, -1.99004745483398, 0.99007225036621]))


def kweight(x):
    y = sg.lfilter(*_SHELF, x, axis=0)
    return sg.lfilter(*_RLB, y, axis=0)


def _blocks(x, win, hop):
    """Mean square per channel over sliding blocks; returns (n_blocks,) summed over channels."""
    y = kweight(x) ** 2
    c = np.cumsum(np.vstack([np.zeros((1, y.shape[1])), y]), axis=0)
    starts = np.arange(0, max(1, len(y) - win + 1), hop)
    ms = (c[starts + win] - c[starts]) / win
    return ms.sum(axis=1), starts


def lufs_from_ms(ms):
    return -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))


def integrated(x):
    """Gated integrated loudness (LUFS). x: (n, 2)."""
    ms, _ = _blocks(x, int(0.4 * SR), int(0.1 * SR))
    l = lufs_from_ms(ms)
    g = ms[l > -70]
    if not len(g):
        return -np.inf
    rel = lufs_from_ms(g.mean()) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return float(lufs_from_ms(g2.mean()))


def momentary(x, hop=0.05):
    """Momentary loudness (400 ms window) every `hop` seconds. Returns (times, LUFS)."""
    ms, starts = _blocks(x, int(0.4 * SR), int(hop * SR))
    return starts / SR, lufs_from_ms(ms)


def momentary_max(x):
    pad = np.vstack([x, np.zeros((int(0.4 * SR), x.shape[1]))])
    return float(momentary(pad, hop=0.01)[1].max())


def true_peak_db(x):
    up = sg.resample_poly(x, 4, 1, axis=0)
    return float(20 * np.log10(max(np.abs(up).max(), 1e-12)))
