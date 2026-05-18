import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-zoom-controls',
  standalone: true,
  imports: [MatIconModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="zoom-controls" *transloco="let t; read: 'map.zoom'">
      <button class="zoom-btn" type="button" (click)="zoomIn.emit()" [title]="t('in')" [attr.aria-label]="t('in')">
        <mat-icon aria-hidden="true">add</mat-icon>
      </button>
      <button class="zoom-btn" type="button" (click)="resetView.emit()" [title]="t('reset')" [attr.aria-label]="t('reset')">
        <mat-icon aria-hidden="true">fit_screen</mat-icon>
      </button>
      <button class="zoom-btn" type="button" (click)="zoomOut.emit()" [title]="t('out')" [attr.aria-label]="t('out')">
        <mat-icon aria-hidden="true">remove</mat-icon>
      </button>
      <button class="zoom-btn" type="button" (click)="openHelp()" [title]="t('helpAria')" [attr.aria-label]="t('helpAria')">
        <mat-icon aria-hidden="true">keyboard</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .zoom-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: var(--app-z-overlay);
    }

    .zoom-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--app-map-outline);
      border-radius: 50%;
      background: var(--app-map-surface);
      color: var(--app-map-on-surface-variant);
      cursor: pointer;
      box-shadow: 0 1px 4px var(--app-map-shadow);
    }

    .zoom-btn:hover {
      background: var(--app-map-surface-container-high);
    }

    .zoom-btn mat-icon {
      font-size: var(--m3-type-headline-small);
      width: 20px;
      height: 20px;
    }

    :host-context(.dark-theme) .zoom-btn {
      background: var(--app-map-surface-container-high);
      border-color: var(--app-map-surface-container-higher);
    }

    :host-context(.dark-theme) .zoom-btn:hover {
      background: var(--app-map-surface-container-higher);
    }

    @media (max-width: 600px) {
      .zoom-controls {
        bottom: 8px;
        right: 8px;
      }
    }
  `,
})
export class ZoomControlsComponent {
  private readonly dialog = inject(MatDialog);

  zoomIn = output();
  zoomOut = output();
  resetView = output();

  openHelp(): void {
    this.dialog.open(MapShortcutsDialogComponent, { autoFocus: 'dialog' });
  }
}

@Component({
  selector: 'app-map-shortcuts-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t; read: 'map.zoom'">
      <h2 mat-dialog-title>{{ t('helpTitle') }}</h2>
      <mat-dialog-content>
        <p class="help-intro">{{ t('helpIntro') }}</p>
        <ul class="shortcut-list">
          <li><kbd>+</kbd> / <kbd>=</kbd> — {{ t('helpZoomIn') }}</li>
          <li><kbd>-</kbd> — {{ t('helpZoomOut') }}</li>
          <li><kbd>0</kbd> — {{ t('helpReset') }}</li>
          <li><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> — {{ t('helpPan') }}</li>
          <li><kbd>Tab</kbd> — {{ t('helpTab') }}</li>
          <li><kbd>Enter</kbd> — {{ t('helpEnter') }}</li>
        </ul>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button color="primary" (click)="close()">{{ t('helpClose') }}</button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: `
    .help-intro { color: var(--app-on-surface-variant); margin: 0 0 16px; }
    .shortcut-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .shortcut-list li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    kbd {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--app-radius-xs);
      border: 1px solid var(--app-outline);
      background: var(--app-surface-variant);
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: var(--m3-type-label-small);
      font-weight: 600;
    }
  `,
})
export class MapShortcutsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MapShortcutsDialogComponent>);
  close(): void {
    this.dialogRef.close();
  }
}
