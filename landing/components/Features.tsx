'use client'

import { motion } from 'framer-motion'
import { 
  Zap, Shield, Globe, BarChart3, Code2, Users, 
  Smartphone, Lock, TrendingUp, Clock, CheckCircle2, Layers 
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Turn Dead Links Into Revenue',
    description: 'Automatically detect broken links on your site and replace them with monetized alternatives that match your content.',
    highlight: true,
    badge: 'Core Feature'
  },
  {
    icon: TrendingUp,
    title: 'Smart Fallback System',
    description: 'Up to 3 backup URLs per link ensure visitors always land somewhere valuable when links break.',
    highlight: true,
    badge: 'Reliability'
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description: 'GDPR compliant, bot detection, rate limiting, and production-ready security features included.',
    highlight: true,
    badge: 'Enterprise'
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Track earnings, clicks, geographic data, and bot vs human traffic with live dashboard updates.',
    highlight: false,
  },
  {
    icon: Globe,
    title: 'Global Edge Network',
    description: 'Deployed on Cloudflare Workers for <100ms redirect speed worldwide.',
    highlight: false,
  },
  {
    icon: Code2,
    title: '5-Minute Setup',
    description: 'Single JavaScript snippet works with any CMS - WordPress, Shopify, custom sites.',
    highlight: false,
  },
  {
    icon: Clock,
    title: 'Automatic Health Checks',
    description: 'Monitor link health every 5 minutes and auto-switch to working alternatives.',
    highlight: false,
  },
  {
    icon: Layers,
    title: 'Developer-First API',
    description: 'Complete REST API, webhooks, QR code generation, and bulk operations for power users.',
    highlight: false,
  },
  {
    icon: CheckCircle2,
    title: 'Zero Maintenance',
    description: 'Set it and forget it - our system handles detection, switching, and optimization automatically.',
    highlight: false,
  },
]

export default function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Enterprise Features That Drive Revenue
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Turn your broken links into a reliable income stream with our automated detection and monetization system
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className={`relative group ${
                feature.highlight ? 'md:col-span-1' : ''
              }`}
            >
              <div className={`h-full p-6 rounded-xl transition-all duration-300 ${
                feature.highlight 
                  ? 'bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20 hover:border-primary/40 hover:shadow-xl' 
                  : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg'
              }`}>
                {feature.badge && (
                  <div className="absolute -top-3 -right-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white shadow-sm">
                      {feature.badge}
                    </span>
                  </div>
                )}

                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${
                  feature.highlight 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-gray-100 text-gray-700 group-hover:bg-primary/10 group-hover:text-primary'
                } transition-colors`}>
                  <feature.icon className="h-6 w-6" />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 text-white text-center"
        >
          <h3 className="text-2xl font-bold mb-4">
            Turn Your Dead Links Into Revenue
          </h3>
          <p className="text-lg mb-6 opacity-90">
            Enterprise-grade link management with automatic dead link detection and smart fallback system
          </p>
          <button className="bg-white text-primary hover:bg-gray-100 h-12 px-8 text-lg inline-flex items-center justify-center rounded-lg font-medium transition-colors">
            Start Free - Setup in 5 Minutes
          </button>
        </motion.div>
      </div>
    </section>
  )
}