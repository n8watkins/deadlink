'use client'

import { motion } from 'framer-motion'
import { 
  Zap, Shield, Globe, BarChart3, Code2, Users, 
  Smartphone, Lock, TrendingUp, Clock, CheckCircle2, Layers 
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Automatic Detection',
    description: 'Real-time monitoring identifies dead links instantly with zero manual effort required.',
    highlight: true,
  },
  {
    icon: TrendingUp,
    title: 'Smart Matching',
    description: 'AI-powered algorithm matches dead links to the most relevant and profitable alternatives.',
    highlight: true,
  },
  {
    icon: BarChart3,
    title: 'Revenue Analytics',
    description: 'Comprehensive dashboard tracks earnings, click-through rates, and optimization opportunities.',
    highlight: false,
  },
  {
    icon: Shield,
    title: 'SEO Friendly',
    description: 'Maintains SEO integrity with proper redirects and search engine compliance.',
    highlight: false,
  },
  {
    icon: Globe,
    title: 'Multi-Language',
    description: 'Works seamlessly across all languages and international markets.',
    highlight: false,
  },
  {
    icon: Code2,
    title: 'Easy Integration',
    description: 'Simple JavaScript snippet works with WordPress, Shopify, and any CMS.',
    highlight: true,
  },
  {
    icon: Smartphone,
    title: 'Mobile Optimized',
    description: 'Lightning-fast redirects optimized for mobile users and slow connections.',
    highlight: false,
  },
  {
    icon: Lock,
    title: 'GDPR Compliant',
    description: 'Full compliance with privacy regulations and transparent data handling.',
    highlight: false,
  },
  {
    icon: Clock,
    title: '24/7 Monitoring',
    description: 'Continuous scanning ensures no dead link goes unmonetized.',
    highlight: false,
  },
  {
    icon: Users,
    title: 'White Label',
    description: 'Custom branding options for agencies and enterprise clients.',
    highlight: false,
  },
  {
    icon: CheckCircle2,
    title: '99.9% Uptime',
    description: 'Enterprise-grade infrastructure ensures reliable service.',
    highlight: false,
  },
  {
    icon: Layers,
    title: 'API Access',
    description: 'Full API for custom integrations and advanced implementations.',
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
            Powerful Features for Maximum Revenue
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to turn link rot into a profitable revenue stream
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
                  ? 'bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20 hover:border-primary/40' 
                  : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg'
              }`}>
                {feature.highlight && (
                  <div className="absolute -top-3 -right-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white">
                      Popular
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
            Ready to monetize your dead links?
          </h3>
          <p className="text-lg mb-6 opacity-90">
            Join thousands of publishers earning passive income from broken links
          </p>
          <button className="bg-white text-primary hover:bg-gray-100 h-12 px-8 text-lg inline-flex items-center justify-center rounded-lg font-medium transition-colors">
            Start Your Free Trial
          </button>
        </motion.div>
      </div>
    </section>
  )
}