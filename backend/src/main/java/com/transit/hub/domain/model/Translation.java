package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Mirrors a row of GTFS {@code translations.txt}. Polymorphic by design —
 * the GTFS spec encodes a single table for every translatable field
 * across {@code stops}, {@code routes}, {@code trips} and friends, with
 * the row keyed by {@code (table_name, record_id, field_name, language)}.
 * <p>
 * {@link #recordId} matches the GTFS row id (e.g. {@code stop_id},
 * {@code route_id}). Our entities persist that id under their
 * {@code external_id} column, so a translation lookup is a join on
 * {@code translations.record_id = X.external_id}.
 */
@Entity
@Table(name = "translations",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_translation_target",
           // field_value is part of the spec key for the value-based
           // matching mode (record_id null → match every row whose
           // field equals field_value); leaving it out of the UK let
           // duplicate field_value translations slip past the import.
           columnNames = {"table_name", "record_id", "record_sub_id",
                          "field_value", "field_name", "language"}),
       indexes = {
           @Index(name = "idx_translation_lang_table",
                  columnList = "language, table_name"),
           @Index(name = "idx_translation_record",
                  columnList = "table_name, record_id, language")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Translation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS table the translated row belongs to: {@code stops},
     *  {@code routes}, {@code trips}, {@code stop_times}, etc. */
    @NotBlank
    @Size(max = 60)
    @Column(name = "table_name", length = 60, nullable = false)
    private String tableName;

    /** GTFS row id (the {@code stop_id}, {@code route_id}, ... — i.e. the
     *  external_id stored on our entities). May be null for the
     *  field-value matching mode (see {@link #fieldValue}). */
    @Size(max = 100)
    @Column(name = "record_id", length = 100)
    private @Nullable String recordId;

    /** Alternative matching key allowed by the spec: when {@code recordId}
     *  is absent, the translation applies to every row whose
     *  {@code fieldName} equals this value. Used for deduplication when
     *  the same string appears on hundreds of stops. */
    @Size(max = 200)
    @Column(name = "field_value", length = 200)
    private @Nullable String fieldValue;

    /** GTFS {@code record_sub_id}. Required when translating
     *  {@code stop_times} rows, where the primary key is
     *  ({@code trip_id}, {@code stop_sequence}) and {@code recordId}
     *  alone (a {@code stop_id}) is ambiguous. The trip_id is
     *  supplied here. Null for every other table. */
    @Size(max = 100)
    @Column(name = "record_sub_id", length = 100)
    private @Nullable String recordSubId;

    /** <strong>Project extension, not part of the GTFS spec.</strong>
     *  Disambiguates two translations of the same record/field/language
     *  for distinct display contexts (e.g. {@code "long-form"} vs
     *  {@code "short-form"}) when the rendering surface needs a hint.
     *  Always {@code null} on rows produced by the standard importer —
     *  populated only by admin-side authoring flows that opt into the
     *  extension. */
    @Size(max = 100)
    @Column(name = "language_context", length = 100)
    private @Nullable String languageContext;

    @NotBlank
    @Size(max = 60)
    @Column(name = "field_name", length = 60, nullable = false)
    private String fieldName;

    /** BCP-47 language tag — {@code "fr"}, {@code "fr-CA"}, {@code "en-GB"}. */
    @NotBlank
    @Size(max = 20)
    @Column(name = "language", length = 20, nullable = false)
    private String language;

    /** The translated value. */
    @NotBlank
    @Column(name = "translation", nullable = false, columnDefinition = "TEXT")
    private String translation;
}
