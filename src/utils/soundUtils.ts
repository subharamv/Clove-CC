/**
 * Play a beep sound using Web Audio API
 */
export function playBeep(type: 'success' | 'error' | 'scan' = 'scan') {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
            oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1); // E6
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } else if (type === 'error') {
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(220, ctx.currentTime); // A3
            oscillator.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2); // A2
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
        } else {
            // Default scan beep
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.1);
        }
    } catch (e) {
        console.warn('Beep failed', e);
    }
}
