/**
 * Root package for the transit-display-hub backend. {@code @NullMarked}
 * at the root keeps the JSpecify intent uniform across every sub-package
 * — every type is non-null by default unless an explicit {@code @Nullable}
 * says otherwise. NullAway already enforces the rule via the
 * {@code AnnotatedPackages=com.transit.hub} compiler option, the
 * annotation is here for documentation and for tooling (IntelliJ,
 * Eclipse) that reads JSpecify directly.
 */
@NullMarked
package com.transit.hub;

import org.jspecify.annotations.NullMarked;
