'use client'

import { motion } from 'framer-motion'
import { Code2, Cpu, DollarSign, BarChart3 } from 'lucide-react'

const steps = [
  {
    icon: Code2,
    title: 'Install Our Snippet',
    description: 'Add our lightweight JavaScript code to your site. Works with any CMS or platform in under 5 minutes.',
    code: `<script src="https://cdn.switchboard.io/v1/switch.js" 
  data-site-id="your-site-id">
</script>`,
  },
  {
    icon: Cpu,
    title: 'Automatic Detection',
    description: 'Our AI continuously scans your site for dead links and catalogs them in real-time.',
    features: ['Zero maintenance', 'Works in background', '24/7 monitoring'],
  },
  {
    icon: DollarSign,
    title: 'Smart Monetization',
    description: 'Dead links are matched with relevant advertisers and content partners for maximum revenue.',
    features: ['AI-powered matching', 'Contextual relevance', 'Optimal pricing'],
  },
  {
    icon: BarChart3,
    title: 'Track & Earn',
    description: 'Monitor your earnings in real-time through our comprehensive analytics dashboard.',
    features: ['Real-time stats', 'Detailed reports', 'Monthly payouts'],
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get started in minutes and start earning from your dead links immediately
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full">
                  <svg
                    className="w-full h-2"
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 5 L100 5"
                      stroke="#E5E7EB"
                      strokeWidth="2"
                      strokeDasharray="5 5"
                    />
                  </svg>
                </div>
              )}

              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{step.description}</p>
                
                {step.code && (
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                    <code>{step.code}</code>
                  </pre>
                )}
                
                {step.features && (
                  <ul className="space-y-1">
                    {step.features.map((feature, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-center">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center justify-center p-4 bg-secondary/10 rounded-lg">
            <span className="text-secondary font-semibold">
              Average setup time: 5 minutes
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}