import { trigger, transition, style, animate, query, group } from '@angular/animations';

// M3 Easing Curves
const M3_EMPHASIZED_DECELERATE = 'cubic-bezier(0.05, 0.7, 0.1, 1)';
const M3_EMPHASIZED_ACCELERATE = 'cubic-bezier(0.3, 0, 0.8, 0.15)';

export const routeSlide = trigger('routeSlide', [
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(
      ':enter, :leave',
      [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
        }),
      ],
      { optional: true }
    ),
    query(':enter', [style({ opacity: 0, transform: 'translateY(20px)' })], { optional: true }),
    group([
      query(
        ':leave',
        [animate(`150ms ${M3_EMPHASIZED_ACCELERATE}`, style({ opacity: 0, transform: 'translateY(-20px)' }))],
        { optional: true }
      ),
      query(
        ':enter',
        [animate(`200ms 100ms ${M3_EMPHASIZED_DECELERATE}`, style({ opacity: 1, transform: 'translateY(0)' }))],
        { optional: true }
      ),
    ]),
  ]),
]);
