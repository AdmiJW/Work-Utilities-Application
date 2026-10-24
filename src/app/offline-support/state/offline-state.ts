import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { SessionState } from '../../sessions/public-api';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

@Injectable({ providedIn: 'root' })
export class OfflineState {
  private readonly updates = inject(SwUpdate);
  private readonly sessions = inject(SessionState);
  private installPrompt: InstallPrompt | null = null;
  readonly online = signal(navigator.onLine);
  readonly offlineReady = signal(false);
  readonly updateReady = signal(false);
  readonly canInstall = signal(false);
  readonly message = signal('');
  readonly supported = this.updates.isEnabled;

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as InstallPrompt;
      this.canInstall.set(true);
    });
    if (this.updates.isEnabled) {
      this.updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this.updateReady.set(true);
        if (event.type === 'VERSION_INSTALLATION_FAILED')
          this.message.set(
            'The update could not be downloaded. Your current version is still available.',
          );
      });
      this.updates.unrecoverable.subscribe(() =>
        this.message.set(
          'An application file is unavailable. Save your work and reload when online.',
        ),
      );
      void this.establishOfflineReadiness().catch(() => {
        if (this.online())
          this.message.set(
            'Offline caching has not finished. Keep this page online and use Check for updates to retry.',
          );
      });
    }
  }

  async install(): Promise<void> {
    if (!this.installPrompt) return;
    await this.installPrompt.prompt();
    await this.installPrompt.userChoice;
    this.canInstall.set(false);
    this.installPrompt = null;
  }

  async checkForUpdate(): Promise<void> {
    if (!this.supported || !this.online()) return;
    try {
      this.message.set('');
      const available = await this.updates.checkForUpdate();
      if (navigator.serviceWorker.controller) this.offlineReady.set(true);
      if (!available && !this.message()) this.message.set('You are using the latest version.');
    } catch {
      this.message.set('Could not check for updates. Try again when connected.');
    }
  }

  private async establishOfflineReadiness(): Promise<void> {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
    // The acknowledged operation waits for Angular's driver initialization and prefetch.
    await this.updates.checkForUpdate();
    this.offlineReady.set(true);
  }

  async reloadForUpdate(): Promise<void> {
    if (await this.sessions.autosave.flush()) window.location.reload();
    else this.message.set('Save failed. Retry saving before reloading the application.');
  }
}
