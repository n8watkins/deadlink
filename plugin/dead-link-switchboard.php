<?php
/**
 * Plugin Name: DeadLink Switchboard
 * Plugin URI: https://deadlink.io/wordpress
 * Description: Automatically convert product links to DeadLink short URLs with fallback support
 * Version: 1.0.0
 * Author: DeadLink Team
 * License: GPL v2 or later
 * Text Domain: deadlink-switchboard
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DEADLINK_VERSION', '1.0.0');
define('DEADLINK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DEADLINK_PLUGIN_PATH', plugin_dir_path(__FILE__));

// Main plugin class
class DeadLinkSwitchboard {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        
        // Hook into content filtering
        add_filter('the_content', array($this, 'process_content'), 999);
        add_filter('widget_text_content', array($this, 'process_content'), 999);
        
        // AJAX hooks
        add_action('wp_ajax_deadlink_scan_posts', array($this, 'ajax_scan_posts'));
        add_action('wp_ajax_deadlink_convert_links', array($this, 'ajax_convert_links'));
        add_action('wp_ajax_deadlink_test_api', array($this, 'ajax_test_api'));
        
        // Activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        // Load text domain for translations
        load_plugin_textdomain('deadlink-switchboard', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    public function add_admin_menu() {
        add_options_page(
            __('DeadLink Switchboard', 'deadlink-switchboard'),
            __('DeadLink', 'deadlink-switchboard'),
            'manage_options',
            'deadlink-switchboard',
            array($this, 'admin_page')
        );
    }
    
    public function admin_init() {
        register_setting('deadlink_settings', 'deadlink_api_key');
        register_setting('deadlink_settings', 'deadlink_api_url');
        register_setting('deadlink_settings', 'deadlink_auto_convert');
        register_setting('deadlink_settings', 'deadlink_domains');
        register_setting('deadlink_settings', 'deadlink_fallback_strategy');
    }
    
    public function process_content($content) {
        // Only process if auto-convert is enabled
        if (!get_option('deadlink_auto_convert', false)) {
            return $content;
        }
        
        // Get configured domains to convert
        $domains = $this->get_target_domains();
        if (empty($domains)) {
            return $content;
        }
        
        // Find and replace product links
        $content = $this->convert_links_in_content($content, $domains);
        
        return $content;
    }
    
    private function convert_links_in_content($content, $domains) {
        // Create regex pattern for target domains
        $domain_pattern = implode('|', array_map('preg_quote', $domains));
        $pattern = '/<a\s+([^>]*href=["\'])(https?:\/\/(?:' . $domain_pattern . ')[^"\']+)(["\'][^>]*)>/i';
        
        return preg_replace_callback($pattern, array($this, 'replace_link_callback'), $content);
    }
    
    private function replace_link_callback($matches) {
        $before_url = $matches[1];
        $original_url = $matches[2];
        $after_url = $matches[3];
        
        // Check if URL is already a DeadLink short URL
        if (strpos($original_url, '/r/') !== false) {
            return $matches[0]; // Don't convert already converted links
        }
        
        // Get or create short URL
        $short_url = $this->get_or_create_short_url($original_url);
        
        if ($short_url) {
            return '<a ' . $before_url . $short_url . $after_url . '>';
        }
        
        return $matches[0]; // Return original if conversion failed
    }
    
    private function get_or_create_short_url($url) {
        // Check cache first
        $cache_key = 'deadlink_url_' . md5($url);
        $cached_url = get_transient($cache_key);
        
        if ($cached_url) {
            return $cached_url;
        }
        
        // Create new short URL via API
        $api_key = get_option('deadlink_api_key');
        $api_url = get_option('deadlink_api_url', 'https://api.deadlink.io');
        
        if (!$api_key) {
            return false;
        }
        
        $fallback_urls = $this->generate_fallback_urls($url);
        
        $response = wp_remote_post($api_url . '/api/v1/links', array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $api_key
            ),
            'body' => json_encode(array(
                'url' => $url,
                'fallback_urls' => $fallback_urls
            )),
            'timeout' => 10
        ));
        
        if (is_wp_error($response)) {
            error_log('DeadLink API Error: ' . $response->get_error_message());
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['short_url'])) {
            // Cache for 24 hours
            set_transient($cache_key, $data['short_url'], DAY_IN_SECONDS);
            return $data['short_url'];
        }
        
        return false;
    }
    
    private function generate_fallback_urls($original_url) {
        $strategy = get_option('deadlink_fallback_strategy', 'similar_products');
        $fallbacks = array();
        
        // Parse the original URL
        $parsed = parse_url($original_url);
        $domain = $parsed['host'];
        
        // Generate fallbacks based on strategy
        switch ($strategy) {
            case 'similar_products':
                $fallbacks = $this->get_similar_product_urls($original_url);
                break;
            case 'category_pages':
                $fallbacks = $this->get_category_page_urls($original_url);
                break;
            case 'homepage':
                $fallbacks[] = $parsed['scheme'] . '://' . $domain;
                break;
        }
        
        return array_filter($fallbacks);
    }
    
    private function get_similar_product_urls($url) {
        // This would integrate with your product matching API
        // For now, return empty array
        return array();
    }
    
    private function get_category_page_urls($url) {
        // Generate category page URLs based on the product URL structure
        $fallbacks = array();
        
        // Amazon-specific logic
        if (strpos($url, 'amazon.com') !== false) {
            // Extract category from breadcrumbs or URL structure
            if (preg_match('/\/([^\/]+)\/dp\//', $url, $matches)) {
                $category = $matches[1];
                $fallbacks[] = "https://amazon.com/s?k=" . urlencode($category);
            }
        }
        
        // Add more e-commerce site logic here
        
        return $fallbacks;
    }
    
    private function get_target_domains() {
        $domains_setting = get_option('deadlink_domains', '');
        
        if (empty($domains_setting)) {
            // Default domains
            return array(
                'amazon.com',
                'amazon.co.uk',
                'walmart.com',
                'target.com',
                'bestbuy.com',
                'ebay.com'
            );
        }
        
        return array_map('trim', explode("\n", $domains_setting));
    }
    
    public function ajax_scan_posts() {
        check_ajax_referer('deadlink_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        $domains = $this->get_target_domains();
        $domain_pattern = implode('|', array_map('preg_quote', $domains));
        
        // Query posts with product links
        $posts = get_posts(array(
            'numberposts' => -1,
            'post_type' => array('post', 'page'),
            'post_status' => 'publish'
        ));
        
        $results = array();
        
        foreach ($posts as $post) {
            $content = $post->post_content;
            
            // Find product links
            preg_match_all('/<a\s+[^>]*href=["\']https?:\/\/(?:' . $domain_pattern . ')[^"\']+["\'][^>]*>/i', $content, $matches);
            
            if (!empty($matches[0])) {
                $results[] = array(
                    'post_id' => $post->ID,
                    'post_title' => $post->post_title,
                    'post_url' => get_permalink($post->ID),
                    'link_count' => count($matches[0]),
                    'links' => $matches[0]
                );
            }
        }
        
        wp_send_json_success($results);
    }
    
    public function ajax_convert_links() {
        check_ajax_referer('deadlink_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        $post_ids = array_map('intval', $_POST['post_ids']);
        $results = array();
        
        foreach ($post_ids as $post_id) {
            $post = get_post($post_id);
            if (!$post) continue;
            
            $original_content = $post->post_content;
            $new_content = $this->convert_links_in_content($original_content, $this->get_target_domains());
            
            if ($original_content !== $new_content) {
                wp_update_post(array(
                    'ID' => $post_id,
                    'post_content' => $new_content
                ));
                
                $results[] = array(
                    'post_id' => $post_id,
                    'post_title' => $post->post_title,
                    'status' => 'converted'
                );
            } else {
                $results[] = array(
                    'post_id' => $post_id,
                    'post_title' => $post->post_title,
                    'status' => 'no_changes'
                );
            }
        }
        
        wp_send_json_success($results);
    }
    
    public function ajax_test_api() {
        check_ajax_referer('deadlink_nonce', 'nonce');
        
        $api_key = sanitize_text_field($_POST['api_key']);
        $api_url = esc_url_raw($_POST['api_url']);
        
        $response = wp_remote_get($api_url . '/api/v1/links?limit=1', array(
            'headers' => array(
                'X-API-Key' => $api_key
            ),
            'timeout' => 10
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error('Connection failed: ' . $response->get_error_message());
        }
        
        $code = wp_remote_retrieve_response_code($response);
        
        if ($code === 200) {
            wp_send_json_success('API connection successful');
        } else {
            wp_send_json_error('API returned error code: ' . $code);
        }
    }
    
    public function admin_page() {
        include DEADLINK_PLUGIN_PATH . 'admin/admin-page.php';
    }
    
    public function activate() {
        // Set default options
        add_option('deadlink_api_url', 'https://api.deadlink.io');
        add_option('deadlink_auto_convert', false);
        add_option('deadlink_fallback_strategy', 'similar_products');
    }
    
    public function deactivate() {
        // Clean up transients
        global $wpdb;
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_deadlink_%'");
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_deadlink_%'");
    }
}

// Initialize the plugin
new DeadLinkSwitchboard();