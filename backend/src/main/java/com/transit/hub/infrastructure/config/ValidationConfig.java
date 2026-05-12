package com.transit.hub.infrastructure.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * Routes Bean Validation messages ({key}-shaped @NotBlank / @Size / …
 * annotations on request DTOs) through the same MessageSource the
 * GlobalExceptionHandler uses. Without this wiring Jakarta validation
 * falls back to its own ValidationMessages.properties bundle and the
 * runtime locale chain stops at the JVM default.
 */
@Configuration
public class ValidationConfig {

    @Bean
    public LocalValidatorFactoryBean validator(MessageSource messageSource) {
        LocalValidatorFactoryBean bean = new LocalValidatorFactoryBean();
        bean.setValidationMessageSource(messageSource);
        return bean;
    }
}
