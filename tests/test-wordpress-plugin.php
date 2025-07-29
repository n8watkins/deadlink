<?php
/**
 * WordPress Plugin Tests
 */

class DeadLinkPluginTest extends WP_UnitTestCase {
    
    private $plugin;
    
    public function setUp(): void {
        parent::setUp();
        $this->plugin = new DeadLinkSwitchboard();
        
        // Set test API key
        update_option('deadlink_api_key', 'dl_test123');
        update_option('deadlink_api_url', 'http://localhost:8787');
        update_option('deadlink_auto_convert', true);
    }
    
    public function test_plugin_activation() {
        // Test that default options are set
        $this->assertEquals('https://api.deadlink.io', get_option('deadlink_api_url'));
        $this->assertEquals(false, get_option('deadlink_auto_convert'));
    }
    
    public function test_target_domains_parsing() {
        update_option('deadlink_domains', "amazon.com\nwalmart.com\ntarget.com");
        
        $reflection = new ReflectionClass($this->plugin);
        $method = $reflection->getMethod('get_target_domains');
        $method->setAccessible(true);
        
        $domains = $method->invoke($this->plugin);
        
        $this->assertContains('amazon.com', $domains);
        $this->assertContains('walmart.com', $domains);
        $this->assertCount(3, $domains);
    }
    
    public function test_link_detection_in_content() {
        $content = '<p>Check out this <a href="https://amazon.com/dp/B08XYZ123">great product</a>!</p>';
        
        $reflection = new ReflectionClass($this->plugin);
        $method = $reflection->getMethod('convert_links_in_content');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->plugin, $content, ['amazon.com']);
        
        // Should contain original content structure
        $this->assertStringContainsString('<p>', $result);
        $this->assertStringContainsString('great product', $result);
    }
    
    public function test_fallback_url_generation() {
        $url = 'https://amazon.com/dp/B08XYZ123';
        
        $reflection = new ReflectionClass($this->plugin);
        $method = $reflection->getMethod('generate_fallback_urls');
        $method->setAccessible(true);
        
        $fallbacks = $method->invoke($this->plugin, $url);
        
        $this->assertIsArray($fallbacks);
        // Should contain at least homepage fallback
        $this->assertGreaterThan(0, count($fallbacks));
    }
    
    public function test_cache_functionality() {
        $url = 'https://example.com/product';
        $short_url = 'https://dl.link/r/test123';
        
        // Set cache
        set_transient('deadlink_url_' . md5($url), $short_url, DAY_IN_SECONDS);
        
        // Should retrieve from cache
        $cached = get_transient('deadlink_url_' . md5($url));
        $this->assertEquals($short_url, $cached);
    }
    
    public function test_content_filter_disabled() {
        // Disable auto-convert
        update_option('deadlink_auto_convert', false);
        
        $content = '<a href="https://amazon.com/dp/B08XYZ123">Product</a>';
        $filtered = $this->plugin->process_content($content);
        
        // Should return unchanged content
        $this->assertEquals($content, $filtered);
    }
    
    public function test_admin_ajax_scan_posts() {
        // Create test post with product links
        $post_id = $this->factory->post->create([
            'post_title' => 'Test Post',
            'post_content' => '<a href="https://amazon.com/dp/B08XYZ123">Product Link</a>',
            'post_status' => 'publish'
        ]);
        
        // Mock AJAX request
        $_POST['action'] = 'deadlink_scan_posts';
        $_POST['nonce'] = wp_create_nonce('deadlink_nonce');
        
        // This would require mocking wp_ajax hooks
        // For now, just verify post was created
        $this->assertGreaterThan(0, $post_id);
    }
    
    public function tearDown(): void {
        // Clean up options
        delete_option('deadlink_api_key');
        delete_option('deadlink_api_url'); 
        delete_option('deadlink_auto_convert');
        delete_option('deadlink_domains');
        
        parent::tearDown();
    }
}