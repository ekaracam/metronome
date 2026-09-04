import { AudioContext, AudioManager } from 'react-native-audio-api';
import type { AudioEventSubscription } from 'react-native-audio-api';

/**
 * Single owner of the audio context and the iOS session category.
 *
 * Nothing else in the app may touch AudioManager. Two callers changing the session
 * independently produces symptoms that only appear on device, and the click is scheduled
 * against this context's clock, so its lifetime has to be owned in one place.
 */

export type AudioMode = 'idle' | 'playback';

export type InterruptionListener = (event: { type: 'began' | 'ended'; shouldResume: boolean }) => void;

class AudioEngine {
  private context: AudioContext | null = null;
  private mode: AudioMode = 'idle';
  private sessionActive = false;
  private interruptionSubscription: AudioEventSubscription | null = null;

  /**
   * Created on first use, never at module load — an AudioContext holds the audio
   * session open and drains battery before the user has pressed anything.
   */
  getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  getMode(): AudioMode {
    return this.mode;
  }

  /** Switches the session category. */
  async setMode(mode: AudioMode): Promise<void> {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === 'idle') {
      await this.deactivateSession();
      return;
    }

    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['allowAirPlay', 'allowBluetoothA2DP'],
    });

    await this.activateSession();
  }

  private async activateSession(): Promise<void> {
    if (this.sessionActive) return;
    await AudioManager.setAudioSessionActivity(true);
    this.sessionActive = true;
  }

  private async deactivateSession(): Promise<void> {
    if (!this.sessionActive) return;
    await AudioManager.setAudioSessionActivity(false);
    this.sessionActive = false;
  }

  /** Phone calls and alarms. The caller decides whether resuming makes musical sense. */
  observeInterruptions(listener: InterruptionListener): () => void {
    AudioManager.observeAudioInterruptions(true);
    this.interruptionSubscription?.remove();
    this.interruptionSubscription = AudioManager.addSystemEventListener('interruption', listener);
    return () => {
      this.interruptionSubscription?.remove();
      this.interruptionSubscription = null;
    };
  }
}

export const audioEngine = new AudioEngine();
