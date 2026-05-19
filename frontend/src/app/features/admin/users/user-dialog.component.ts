import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from '@shared/models';
import { runDialogSubmit } from '@shared/admin/dialog-submit';
import { CrudDialogComponent } from '@shared/components/crud-dialog/crud-dialog.component';

export interface UserDialogData {
  user?: User;
  isEdit: boolean;
  submit: (request: CreateUserRequest | UpdateUserRequest) => Observable<User>;
  onError?: (err: unknown) => void;
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    CrudDialogComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <app-crud-dialog
      [title]="data.user ? t('admin.users.dialog.titleEdit') : t('admin.users.dialog.titleCreate')"
      [submitLabel]="data.user ? t('admin.users.dialog.actionSave') : t('admin.users.dialog.actionCreate')"
      [cancelLabel]="t('common.cancel')"
      [submitDisabled]="!isFormValid()"
      [submitting]="submitting()"
      (submitted)="save()"
    >
      <form #userForm="ngForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.users.dialog.fieldUsername') }}</mat-label>
          <input
            matInput
            [(ngModel)]="form.username"
            name="username"
            [required]="!data.isEdit"
            [disabled]="data.isEdit"
            minlength="3"
            maxlength="50"
            [placeholder]="t('admin.users.dialog.fieldUsernamePlaceholder')"
          />
          @if (!data.isEdit) {
            <mat-hint>{{ t('admin.users.dialog.fieldUsernameHint') }}</mat-hint>
          }
          @if (!data.isEdit) {
            <mat-error>{{ t('admin.users.dialog.fieldUsernameRequired') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.users.dialog.fieldPassword') }}</mat-label>
          <input
            matInput
            type="password"
            [(ngModel)]="form.password"
            name="password"
            [required]="!data.isEdit"
            minlength="6"
            maxlength="100"
            [placeholder]="data.isEdit ? t('admin.users.dialog.fieldPasswordPlaceholderEdit') : t('admin.users.dialog.fieldPasswordPlaceholderCreate')"
          />
          <mat-hint>{{ data.isEdit ? t('admin.users.dialog.fieldPasswordHintEdit') : t('admin.users.dialog.fieldPasswordHintCreate') }}</mat-hint>
          <mat-error>{{ data.isEdit ? t('admin.users.dialog.fieldPasswordErrorEdit') : t('admin.users.dialog.fieldPasswordErrorCreate') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.users.dialog.fieldRole') }}</mat-label>
          <mat-select [(ngModel)]="form.role" name="role" required>
            <mat-option value="ADMIN">
              <span class="role-option">
                <strong>ADMIN</strong>
                <span class="role-desc">{{ t('admin.users.dialog.roleAdminDesc') }}</span>
              </span>
            </mat-option>
            <mat-option value="AGENT">
              <span class="role-option">
                <strong>AGENT</strong>
                <span class="role-desc">{{ t('admin.users.dialog.roleAgentDesc') }}</span>
              </span>
            </mat-option>
          </mat-select>
          <mat-error>{{ t('admin.users.dialog.fieldRoleRequired') }}</mat-error>
        </mat-form-field>

        @if (data.isEdit) {
          <div class="toggle-row">
            <mat-slide-toggle [(ngModel)]="form.enabled" name="enabled">
              {{ t('admin.users.dialog.fieldEnabled') }}
            </mat-slide-toggle>
            <span class="toggle-hint">{{ t('admin.users.dialog.fieldEnabledHint') }}</span>
          </div>
        }
      </form>
    </app-crud-dialog>
    </ng-container>
  `,
  styles: `
    .role-option {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .role-desc {
      font-size: var(--m3-type-label-medium);
      color: var(--app-on-surface-variant);
    }

    .toggle-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 0;
    }

    .toggle-hint {
      font-size: var(--m3-type-label-medium);
      color: var(--app-on-surface-variant);
      margin-left: 48px;
    }
  `,
})
export class UserDialogComponent {
  readonly dialogRef = inject(MatDialogRef<UserDialogComponent>);
  readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);

  form: {
    username: string;
    password: string;
    role: UserRole;
    enabled: boolean;
  } = {
    username: this.data.user?.username ?? '',
    password: '',
    role: this.data.user?.role ?? 'AGENT',
    enabled: this.data.user?.enabled ?? true,
  };

  readonly submitting = signal(false);

  isFormValid(): boolean {
    if (this.data.isEdit) {
      // For edit: role is required, password optional
      return !!this.form.role;
    } else {
      // For create: all fields required
      return (
        !!this.form.username &&
        this.form.username.length >= 3 &&
        !!this.form.password &&
        this.form.password.length >= 6 &&
        !!this.form.role
      );
    }
  }

  save(): void {
    const request: CreateUserRequest | UpdateUserRequest = this.data.isEdit
      ? {
          password: this.form.password || undefined,
          role: this.form.role,
          enabled: this.form.enabled,
        }
      : {
          username: this.form.username,
          password: this.form.password,
          role: this.form.role,
        };
    runDialogSubmit(this.submitting, () => this.data.submit(request), this.dialogRef, this.data.onError);
  }
}
