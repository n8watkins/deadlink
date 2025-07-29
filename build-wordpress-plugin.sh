#!/bin/bash

echo "📦 Building WordPress Plugin Package"

# Create distribution directory
rm -rf dist
mkdir -p dist/dead-link-switchboard

# Copy plugin files
cp dead-link-wordpress-plugin/dead-link-switchboard.php dist/dead-link-switchboard/
cp -r dead-link-wordpress-plugin/admin dist/dead-link-switchboard/
cp -r dead-link-wordpress-plugin/assets dist/dead-link-switchboard/

# Create languages directory
mkdir -p dist/dead-link-switchboard/languages

# Create README for WordPress plugin
cat > dist/dead-link-switchboard/README.txt << 'EOF'
=== DeadLink Switchboard ===
Contributors: deadlinkteam
Tags: affiliate, links, marketing, redirects, conversion
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL v2 or later

Automatically convert product links to DeadLink short URLs with fallback support.

== Description ==

DeadLink Switchboard helps you protect your affiliate revenue by automatically converting product links to smart short URLs with automatic failover when links break.

**Key Features:**

* Automatic link conversion for major e-commerce sites
* Smart fallback URL generation 
* Bulk conversion tool for existing posts
* Real-time link health monitoring
* Detailed analytics and reporting
* Easy-to-use admin interface

**Supported E-commerce Sites:**

* Amazon (all regions)
* Walmart
* Target
* Best Buy
* eBay
* And many more...

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/dead-link-switchboard/`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to Settings > DeadLink to configure the plugin
4. Enter your DeadLink API key (get one from deadlink.io)
5. Configure your target domains and fallback strategy

== Frequently Asked Questions ==

= Do I need a DeadLink account? =

Yes, you need a DeadLink API key to use this plugin. Sign up at deadlink.io for a free account.

= Will this slow down my website? =

No, the plugin uses caching and only processes links when content is displayed. The impact is minimal.

= Can I convert existing posts? =

Yes, use the bulk conversion tool in the plugin settings to convert existing posts automatically.

== Screenshots ==

1. Plugin settings page with API configuration
2. Bulk conversion tool showing scan results
3. Link conversion progress tracking

== Changelog ==

= 1.0.0 =
* Initial release
* Automatic link conversion
* Bulk conversion tool
* Smart fallback generation
* Admin interface
* Caching system

== Upgrade Notice ==

= 1.0.0 =
Initial release of DeadLink Switchboard plugin.
EOF

# Create plugin zip
cd dist
zip -r dead-link-switchboard.zip dead-link-switchboard/
cd ..

echo "✅ Plugin package created: dist/dead-link-switchboard.zip"

# Create JavaScript snippet minified version
echo "🗜️ Creating minified JavaScript snippet..."

# Simple minification (remove comments and extra whitespace)
sed 's|//.*||g' dead-link-wordpress-plugin/assets/deadlink-snippet.js | \
tr -s ' \t\n' ' ' > dist/deadlink.min.js

echo "✅ Minified snippet created: dist/deadlink.min.js"

# Create CDN-ready package
mkdir -p dist/cdn/v1
cp dist/deadlink.min.js dist/cdn/v1/deadlink.min.js
cp dead-link-wordpress-plugin/assets/deadlink-snippet.js dist/cdn/v1/deadlink.js

echo "✅ CDN package created: dist/cdn/"

echo "🎉 Build complete!"
echo ""
echo "📁 Distribution Files:"
echo "  - WordPress Plugin: dist/dead-link-switchboard.zip"
echo "  - JS Snippet (min): dist/deadlink.min.js" 
echo "  - CDN Package: dist/cdn/"
echo ""
echo "🚀 Ready for deployment!"