<?php
// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Save settings if form submitted
if (isset($_POST['submit'])) {
    check_admin_referer('deadlink_settings_nonce');
    
    update_option('deadlink_api_key', sanitize_text_field($_POST['deadlink_api_key']));
    update_option('deadlink_api_url', esc_url_raw($_POST['deadlink_api_url']));
    update_option('deadlink_auto_convert', isset($_POST['deadlink_auto_convert']));
    update_option('deadlink_domains', sanitize_textarea_field($_POST['deadlink_domains']));
    update_option('deadlink_fallback_strategy', sanitize_text_field($_POST['deadlink_fallback_strategy']));
    
    echo '<div class="notice notice-success"><p>' . __('Settings saved successfully!', 'deadlink-switchboard') . '</p></div>';
}

// Get current settings
$api_key = get_option('deadlink_api_key', '');
$api_url = get_option('deadlink_api_url', 'https://api.deadlink.io');
$auto_convert = get_option('deadlink_auto_convert', false);
$domains = get_option('deadlink_domains', "amazon.com\namazon.co.uk\nwalmart.com\ntarget.com\nbestbuy.com\nebay.com");
$fallback_strategy = get_option('deadlink_fallback_strategy', 'similar_products');
?>

<div class="wrap">
    <h1><?php _e('DeadLink Switchboard Settings', 'deadlink-switchboard'); ?></h1>
    
    <div class="deadlink-admin-container">
        <!-- Settings Form -->
        <div class="deadlink-settings-panel">
            <h2><?php _e('API Configuration', 'deadlink-switchboard'); ?></h2>
            
            <form method="post" action="">
                <?php wp_nonce_field('deadlink_settings_nonce'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="deadlink_api_key"><?php _e('API Key', 'deadlink-switchboard'); ?></label>
                        </th>
                        <td>
                            <input type="password" id="deadlink_api_key" name="deadlink_api_key" 
                                   value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                            <p class="description">
                                <?php _e('Your DeadLink API key. Get one from your dashboard.', 'deadlink-switchboard'); ?>
                            </p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="deadlink_api_url"><?php _e('API URL', 'deadlink-switchboard'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="deadlink_api_url" name="deadlink_api_url" 
                                   value="<?php echo esc_attr($api_url); ?>" class="regular-text" />
                            <button type="button" id="test-api-connection" class="button">
                                <?php _e('Test Connection', 'deadlink-switchboard'); ?>
                            </button>
                            <div id="api-test-result"></div>
                        </td>
                    </tr>
                </table>
                
                <h2><?php _e('Link Conversion Settings', 'deadlink-switchboard'); ?></h2>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <?php _e('Auto Convert', 'deadlink-switchboard'); ?>
                        </th>
                        <td>
                            <label>
                                <input type="checkbox" name="deadlink_auto_convert" value="1" 
                                       <?php checked($auto_convert); ?> />
                                <?php _e('Automatically convert product links in posts and pages', 'deadlink-switchboard'); ?>
                            </label>
                            <p class="description">
                                <?php _e('When enabled, product links will be automatically converted to DeadLink URLs when displaying content.', 'deadlink-switchboard'); ?>
                            </p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="deadlink_domains"><?php _e('Target Domains', 'deadlink-switchboard'); ?></label>
                        </th>
                        <td>
                            <textarea id="deadlink_domains" name="deadlink_domains" rows="8" class="large-text"><?php echo esc_textarea($domains); ?></textarea>
                            <p class="description">
                                <?php _e('One domain per line. Links from these domains will be converted to DeadLink URLs.', 'deadlink-switchboard'); ?>
                            </p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="deadlink_fallback_strategy"><?php _e('Fallback Strategy', 'deadlink-switchboard'); ?></label>
                        </th>
                        <td>
                            <select id="deadlink_fallback_strategy" name="deadlink_fallback_strategy">
                                <option value="similar_products" <?php selected($fallback_strategy, 'similar_products'); ?>>
                                    <?php _e('Similar Products', 'deadlink-switchboard'); ?>
                                </option>
                                <option value="category_pages" <?php selected($fallback_strategy, 'category_pages'); ?>>
                                    <?php _e('Category Pages', 'deadlink-switchboard'); ?>
                                </option>
                                <option value="homepage" <?php selected($fallback_strategy, 'homepage'); ?>>
                                    <?php _e('Store Homepage', 'deadlink-switchboard'); ?>
                                </option>
                            </select>
                            <p class="description">
                                <?php _e('How to generate fallback URLs when the primary product link fails.', 'deadlink-switchboard'); ?>
                            </p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
        </div>
        
        <!-- Bulk Conversion Tool -->
        <div class="deadlink-tools-panel">
            <h2><?php _e('Bulk Link Conversion', 'deadlink-switchboard'); ?></h2>
            <p><?php _e('Scan your existing posts and convert product links to DeadLink URLs.', 'deadlink-switchboard'); ?></p>
            
            <button type="button" id="scan-posts" class="button button-primary">
                <?php _e('Scan Posts for Product Links', 'deadlink-switchboard'); ?>
            </button>
            
            <div id="scan-results" style="display: none;">
                <h3><?php _e('Scan Results', 'deadlink-switchboard'); ?></h3>
                <div id="posts-with-links"></div>
                
                <button type="button" id="convert-selected" class="button button-primary" style="display: none;">
                    <?php _e('Convert Selected Links', 'deadlink-switchboard'); ?>
                </button>
            </div>
            
            <div id="conversion-progress" style="display: none;">
                <h3><?php _e('Conversion Progress', 'deadlink-switchboard'); ?></h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div id="conversion-log"></div>
            </div>
        </div>
    </div>
</div>

<style>
.deadlink-admin-container {
    display: flex;
    gap: 20px;
    margin-top: 20px;
}

.deadlink-settings-panel {
    flex: 2;
    background: #fff;
    padding: 20px;
    border: 1px solid #ccd0d4;
    box-shadow: 0 1px 1px rgba(0,0,0,.04);
}

.deadlink-tools-panel {
    flex: 1;
    background: #fff;
    padding: 20px;
    border: 1px solid #ccd0d4;
    box-shadow: 0 1px 1px rgba(0,0,0,.04);
}

.progress-bar {
    width: 100%;
    height: 20px;
    background-color: #f0f0f0;
    border-radius: 10px;
    overflow: hidden;
    margin: 10px 0;
}

.progress-fill {
    height: 100%;
    background-color: #007cba;
    transition: width 0.3s ease;
}

.post-scan-result {
    border: 1px solid #ddd;
    padding: 10px;
    margin: 10px 0;
    border-radius: 4px;
}

.post-scan-result.selected {
    background-color: #e7f3ff;
    border-color: #007cba;
}

#api-test-result {
    margin-top: 10px;
    padding: 5px;
    border-radius: 3px;
}

#api-test-result.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

#api-test-result.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}
</style>

<script>
jQuery(document).ready(function($) {
    // Test API connection
    $('#test-api-connection').click(function() {
        const button = $(this);
        const result = $('#api-test-result');
        const apiKey = $('#deadlink_api_key').val();
        const apiUrl = $('#deadlink_api_url').val();
        
        if (!apiKey || !apiUrl) {
            result.removeClass('success').addClass('error').text('Please enter API key and URL');
            return;
        }
        
        button.prop('disabled', true).text('Testing...');
        result.removeClass('success error').text('');
        
        $.post(ajaxurl, {
            action: 'deadlink_test_api',
            api_key: apiKey,
            api_url: apiUrl,
            nonce: '<?php echo wp_create_nonce('deadlink_nonce'); ?>'
        }, function(response) {
            if (response.success) {
                result.addClass('success').text(response.data);
            } else {
                result.addClass('error').text(response.data);
            }
        }).always(function() {
            button.prop('disabled', false).text('Test Connection');
        });
    });
    
    // Scan posts for product links
    $('#scan-posts').click(function() {
        const button = $(this);
        const results = $('#scan-results');
        const container = $('#posts-with-links');
        
        button.prop('disabled', true).text('Scanning...');
        container.empty();
        
        $.post(ajaxurl, {
            action: 'deadlink_scan_posts',
            nonce: '<?php echo wp_create_nonce('deadlink_nonce'); ?>'
        }, function(response) {
            if (response.success) {
                const posts = response.data;
                
                if (posts.length === 0) {
                    container.html('<p>No posts with product links found.</p>');
                } else {
                    let html = '<p>Found ' + posts.length + ' posts with product links:</p>';
                    
                    posts.forEach(function(post) {
                        html += '<div class="post-scan-result" data-post-id="' + post.post_id + '">';
                        html += '<label><input type="checkbox" checked> ';
                        html += '<strong>' + post.post_title + '</strong></label>';
                        html += '<p>' + post.link_count + ' product links found</p>';
                        html += '<a href="' + post.post_url + '" target="_blank">View Post</a>';
                        html += '</div>';
                    });
                    
                    container.html(html);
                    $('#convert-selected').show();
                }
                
                results.show();
            } else {
                alert('Scan failed: ' + response.data);
            }
        }).always(function() {
            button.prop('disabled', false).text('Scan Posts for Product Links');
        });
    });
    
    // Convert selected links
    $('#convert-selected').click(function() {
        const selectedPosts = [];
        $('.post-scan-result input:checked').each(function() {
            selectedPosts.push($(this).closest('.post-scan-result').data('post-id'));
        });
        
        if (selectedPosts.length === 0) {
            alert('Please select at least one post to convert.');
            return;
        }
        
        const progress = $('#conversion-progress');
        const progressFill = $('.progress-fill');
        const log = $('#conversion-log');
        
        progress.show();
        log.empty();
        
        $.post(ajaxurl, {
            action: 'deadlink_convert_links',
            post_ids: selectedPosts,
            nonce: '<?php echo wp_create_nonce('deadlink_nonce'); ?>'
        }, function(response) {
            if (response.success) {
                const results = response.data;
                let html = '<h4>Conversion Results:</h4>';
                
                results.forEach(function(result) {
                    html += '<p>';
                    html += '<strong>' + result.post_title + '</strong>: ';
                    html += result.status === 'converted' ? 
                           '<span style="color: green;">Converted</span>' : 
                           '<span style="color: orange;">No changes needed</span>';
                    html += '</p>';
                });
                
                log.html(html);
                progressFill.css('width', '100%');
            } else {
                log.html('<p style="color: red;">Conversion failed: ' + response.data + '</p>');
            }
        });
    });
    
    // Toggle post selection
    $(document).on('change', '.post-scan-result input[type="checkbox"]', function() {
        $(this).closest('.post-scan-result').toggleClass('selected', this.checked);
    });
});
</script>