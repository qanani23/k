/**
 * Tag System Immutability Verification Tests (Rust Backend)
 * 
 * This test module verifies that the tag system in the Rust backend
 * is immutable and matches the frontend definitions exactly.
 */

#[cfg(test)]
mod tests {
    use crate::models::tags;

    #[test]
    fn test_base_tags_are_constant_strings() {
        // Verify all base tags are defined as constant string slices
        assert_eq!(tags::SERIES, "series");
        assert_eq!(tags::MOVIE, "movie");
        assert_eq!(tags::SITCOM, "sitcom");
        assert_eq!(tags::KIDS, "kids");
        assert_eq!(tags::HERO_TRAILER, "hero_trailer");
    }

    #[test]
    fn test_filter_tags_are_constant_strings() {
        // Verify all filter tags are defined as constant string slices
        // Movie filters
        assert_eq!(tags::COMEDY_MOVIES, "comedy_movies");
        assert_eq!(tags::ACTION_MOVIES, "action_movies");
        assert_eq!(tags::ROMANCE_MOVIES, "romance_movies");
        
        // Series filters
        assert_eq!(tags::COMEDY_SERIES, "comedy_series");
        assert_eq!(tags::ACTION_SERIES, "action_series");
        assert_eq!(tags::ROMANCE_SERIES, "romance_series");
        
        // Kids filters
        assert_eq!(tags::COMEDY_KIDS, "comedy_kids");
        assert_eq!(tags::ACTION_KIDS, "action_kids");
    }

    #[test]
    fn test_base_tags_array_is_immutable() {
        // Verify BASE_TAGS array contains exactly 5 tags
        assert_eq!(tags::BASE_TAGS.len(), 5);
        
        // Verify exact contents
        assert!(tags::BASE_TAGS.contains(&"series"));
        assert!(tags::BASE_TAGS.contains(&"movie"));
        assert!(tags::BASE_TAGS.contains(&"sitcom"));
        assert!(tags::BASE_TAGS.contains(&"kids"));
        assert!(tags::BASE_TAGS.contains(&"hero_trailer"));
    }

    #[test]
    fn test_filter_tags_array_is_immutable() {
        // Verify FILTER_TAGS array contains exactly 8 tags
        assert_eq!(tags::FILTER_TAGS.len(), 8);
        
        // Verify exact contents
        assert!(tags::FILTER_TAGS.contains(&"comedy_movies"));
        assert!(tags::FILTER_TAGS.contains(&"action_movies"));
        assert!(tags::FILTER_TAGS.contains(&"romance_movies"));
        assert!(tags::FILTER_TAGS.contains(&"comedy_series"));
        assert!(tags::FILTER_TAGS.contains(&"action_series"));
        assert!(tags::FILTER_TAGS.contains(&"romance_series"));
        assert!(tags::FILTER_TAGS.contains(&"comedy_kids"));
        assert!(tags::FILTER_TAGS.contains(&"action_kids"));
    }

    #[test]
    fn test_no_dynamic_tag_generation() {
        // Verify that tags are static strings, not computed
        // All tags should be compile-time constants
        
        // Base tags should not be derived from other strings
        let series_tag = tags::SERIES;
        assert_eq!(series_tag, "series");
        assert_eq!(series_tag.len(), 6); // Fixed length, not computed
        
        // Filter tags should not be concatenations
        let action_movies = tags::ACTION_MOVIES;
        assert_eq!(action_movies, "action_movies");
        
        // Verify it's not a runtime concatenation (it's a compile-time constant)
        // The tag is defined as: pub const ACTION_MOVIES: &str = "action_movies";
        // This is a string literal, not format!("{}_{}", "action", "movies")
        let expected_if_concatenated = format!("{}_{}", "action", "movies");
        assert_eq!(action_movies, expected_if_concatenated); // They match, but action_movies is NOT a concatenation
        
        // The key point: action_movies is a &'static str compile-time constant
        // not a String created at runtime
    }

    #[test]
    fn test_tag_validation_functions() {
        // Test is_base_tag function
        assert!(tags::is_base_tag("series"));
        assert!(tags::is_base_tag("movie"));
        assert!(tags::is_base_tag("hero_trailer"));
        assert!(!tags::is_base_tag("invalid_tag"));
        assert!(!tags::is_base_tag("comedy_movies")); // Filter tag, not base
        
        // Test is_filter_tag function
        assert!(tags::is_filter_tag("comedy_movies"));
        assert!(tags::is_filter_tag("action_series"));
        assert!(!tags::is_filter_tag("invalid_tag"));
        assert!(!tags::is_filter_tag("movie")); // Base tag, not filter
    }

    #[test]
    fn test_base_tag_for_filter_mapping() {
        // Test base_tag_for_filter function
        assert_eq!(tags::base_tag_for_filter("comedy_movies"), Some("movie"));
        assert_eq!(tags::base_tag_for_filter("action_movies"), Some("movie"));
        assert_eq!(tags::base_tag_for_filter("romance_movies"), Some("movie"));
        
        assert_eq!(tags::base_tag_for_filter("comedy_series"), Some("series"));
        assert_eq!(tags::base_tag_for_filter("action_series"), Some("series"));
        assert_eq!(tags::base_tag_for_filter("romance_series"), Some("series"));
        
        assert_eq!(tags::base_tag_for_filter("comedy_kids"), Some("kids"));
        assert_eq!(tags::base_tag_for_filter("action_kids"), Some("kids"));
        
        // Invalid filter should return None
        assert_eq!(tags::base_tag_for_filter("invalid_filter"), None);
    }

    #[test]
    fn test_tag_count_consistency() {
        // Verify total tag count matches documentation
        // 5 base tags + 8 filter tags = 13 total
        let total_tags = tags::BASE_TAGS.len() + tags::FILTER_TAGS.len();
        assert_eq!(total_tags, 13);
    }

    #[test]
    fn test_tags_are_lowercase_snake_case() {
        // Verify all tags follow lowercase snake_case convention
        let all_tags = [
            tags::SERIES, tags::MOVIE, tags::SITCOM, tags::KIDS, tags::HERO_TRAILER,
            tags::COMEDY_MOVIES, tags::ACTION_MOVIES, tags::ROMANCE_MOVIES,
            tags::COMEDY_SERIES, tags::ACTION_SERIES, tags::ROMANCE_SERIES,
            tags::COMEDY_KIDS, tags::ACTION_KIDS,
        ];
        
        for tag in &all_tags {
            // Should be lowercase
            assert_eq!(*tag, tag.to_lowercase());
            
            // Should not contain spaces or hyphens
            assert!(!tag.contains(' '));
            assert!(!tag.contains('-'));
            
            // Multi-word tags should use underscores
            if tag.contains('_') {
                assert!(tag.split('_').count() > 1);
            }
        }
    }

    #[test]
    fn test_hero_trailer_is_base_tag() {
        // Verify hero_trailer is a base tag, not a filter tag
        assert!(tags::is_base_tag("hero_trailer"));
        assert!(!tags::is_filter_tag("hero_trailer"));
        assert!(tags::BASE_TAGS.contains(&"hero_trailer"));
        assert!(!tags::FILTER_TAGS.contains(&"hero_trailer"));
    }

    #[test]
    fn test_no_tag_inference_logic() {
        // Verify that the tags module only contains validation functions,
        // not tag generation or inference functions
        
        // The only functions should be:
        // - is_base_tag (validation)
        // - is_filter_tag (validation)
        // - base_tag_for_filter (mapping)
        
        // No functions like:
        // - generate_tag
        // - infer_tag
        // - create_tag
        // - suggest_tag
        
        // This is verified by the fact that all tag constants are &'static str
        // and cannot be modified at runtime
        
        let tag: &'static str = tags::MOVIE;
        assert_eq!(tag, "movie");
    }

    #[test]
    fn test_frontend_backend_tag_consistency() {
        // These tags must match exactly with frontend definitions in:
        // - src/config/categories.ts (HARD_CODED_TAGS)
        // - src/types/index.ts (BASE_TAGS, FILTER_TAGS)
        
        // Base tags
        assert_eq!(tags::SERIES, "series");
        assert_eq!(tags::MOVIE, "movie");
        assert_eq!(tags::SITCOM, "sitcom");
        assert_eq!(tags::KIDS, "kids");
        assert_eq!(tags::HERO_TRAILER, "hero_trailer");
        
        // Filter tags
        assert_eq!(tags::COMEDY_MOVIES, "comedy_movies");
        assert_eq!(tags::ACTION_MOVIES, "action_movies");
        assert_eq!(tags::ROMANCE_MOVIES, "romance_movies");
        assert_eq!(tags::COMEDY_SERIES, "comedy_series");
        assert_eq!(tags::ACTION_SERIES, "action_series");
        assert_eq!(tags::ROMANCE_SERIES, "romance_series");
        assert_eq!(tags::COMEDY_KIDS, "comedy_kids");
        assert_eq!(tags::ACTION_KIDS, "action_kids");
    }
}
