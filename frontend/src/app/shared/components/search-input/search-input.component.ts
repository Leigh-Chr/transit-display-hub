import { ChangeDetectionStrategy, Component, input, output, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
      <mat-icon matPrefix>search</mat-icon>
      <input
        matInput
        type="text"
        [placeholder]="placeholder()"
        [(ngModel)]="searchValue"
        (ngModelChange)="onSearchChange($event)"
      />
      @if (searchValue) {
        <button matSuffix mat-icon-button (click)="clearSearch()" [attr.aria-label]="'common.ariaLabel.clearSearch' | transloco">
          <mat-icon>close</mat-icon>
        </button>
      }
    </mat-form-field>
  `,
  styles: `
    .search-field {
      width: 100%;
      max-width: 300px;
    }

    :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    mat-icon[matPrefix] {
      color: var(--app-on-surface-variant);
      margin-right: 8px;
    }
  `,
})
export class SearchInputComponent implements OnInit {
  readonly placeholder = input('Search...');
  readonly initialValue = input('');
  readonly debounceMs = input(300);
  readonly searchChange = output<string>();

  searchValue = '';

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchValue = this.initialValue();

    this.searchSubject
      .pipe(
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => {
        this.searchChange.emit(value);
      });
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.searchChange.emit('');
  }
}
