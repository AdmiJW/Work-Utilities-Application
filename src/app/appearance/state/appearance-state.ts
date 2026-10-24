import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionRepository } from '../../sessions/public-api';

export type ThemePreference = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class AppearanceState {
  private readonly repository = inject(SessionRepository);
  private readonly media = matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);
  private readonly preferenceState = signal<ThemePreference>('system');
  readonly preference = this.preferenceState.asReadonly();
  readonly isDark = computed(
    () => this.preference() === 'dark' || (this.preference() === 'system' && this.systemDark()),
  );

  constructor() {
    this.media.addEventListener('change', (event) => this.systemDark.set(event.matches));
    void this.repository
      .getPreference('theme')
      .then((value) => {
        if (value === 'dark' || value === 'light' || value === 'system')
          this.preferenceState.set(value);
      })
      .catch(() => undefined);
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
      document.documentElement.style.colorScheme = this.isDark() ? 'dark' : 'light';
    });
  }

  setPreference(value: ThemePreference): void {
    this.preferenceState.set(value);
    void this.repository.setPreference('theme', value).catch(() => undefined);
  }

  toggle(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }
}
