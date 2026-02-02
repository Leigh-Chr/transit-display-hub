import { Component, input, output, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
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
        <button matSuffix mat-icon-button (click)="clearSearch()" aria-label="Clear search">
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
export class SearchInputComponent implements OnInit, OnDestroy {
  readonly placeholder = input('Search...');
  readonly initialValue = input('');
  readonly debounceMs = input(300);
  readonly searchChange = output<string>();

  searchValue = '';

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchValue = this.initialValue();

    this.searchSubject
      .pipe(
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.searchChange.emit(value);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.searchChange.emit('');
  }
}
