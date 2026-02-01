import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

// M3 Easing Curve
const M3_EMPHASIZED_DECELERATE = 'cubic-bezier(0.05, 0.7, 0.1, 1)';

export const listStagger = trigger('listStagger', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        stagger('50ms', [
          animate(`250ms ${M3_EMPHASIZED_DECELERATE}`, style({ opacity: 1, transform: 'translateY(0)' })),
        ]),
      ],
      { optional: true }
    ),
  ]),
]);

export const gridStagger = trigger('gridStagger', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        stagger('40ms', [
          animate(`250ms ${M3_EMPHASIZED_DECELERATE}`, style({ opacity: 1, transform: 'scale(1)' })),
        ]),
      ],
      { optional: true }
    ),
  ]),
]);
