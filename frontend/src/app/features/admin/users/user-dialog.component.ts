import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from '@shared/models';

export interface UserDialogData {
  user?: User;
  isEdit: boolean;
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ data.isEdit ? 'Edit User' : 'New User' }}
    </h2>
    <mat-dialog-content>
      <form #userForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Username</mat-label>
          <input
            matInput
            [(ngModel)]="form.username"
            name="username"
            [required]="!data.isEdit"
            [disabled]="data.isEdit"
            minlength="3"
            maxlength="50"
            placeholder="Enter username"
          />
          @if (!data.isEdit) {
            <mat-hint>3-50 characters</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input
            matInput
            type="password"
            [(ngModel)]="form.password"
            name="password"
            [required]="!data.isEdit"
            minlength="6"
            maxlength="100"
            [placeholder]="data.isEdit ? 'Leave empty to keep current' : 'Enter password'"
          />
          <mat-hint>{{ data.isEdit ? 'Leave empty to keep current password' : 'Minimum 6 characters' }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select [(ngModel)]="form.role" name="role" required>
            <mat-option value="ADMIN">
              <span class="role-option">
                <strong>ADMIN</strong>
                <span class="role-desc">Full access to all features</span>
              </span>
            </mat-option>
            <mat-option value="AGENT">
              <span class="role-option">
                <strong>AGENT</strong>
                <span class="role-desc">Can only manage messages</span>
              </span>
            </mat-option>
          </mat-select>
        </mat-form-field>

        @if (data.isEdit) {
          <div class="toggle-row">
            <mat-slide-toggle [(ngModel)]="form.enabled" name="enabled">
              Account enabled
            </mat-slide-toggle>
            <span class="toggle-hint">Disabled accounts cannot log in</span>
          </div>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!isFormValid()"
        (click)="save()"
      >
        {{ data.isEdit ? 'Save Changes' : 'Create User' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: var(--app-dialog-min-width);
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .role-option {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .role-desc {
      font-size: 12px;
      color: var(--app-on-surface-variant);
    }

    .toggle-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 0;
    }

    .toggle-hint {
      font-size: 12px;
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
    if (this.data.isEdit) {
      const request: UpdateUserRequest = {
        password: this.form.password || undefined,
        role: this.form.role,
        enabled: this.form.enabled,
      };
      this.dialogRef.close(request);
    } else {
      const request: CreateUserRequest = {
        username: this.form.username,
        password: this.form.password,
        role: this.form.role,
      };
      this.dialogRef.close(request);
    }
  }
}
