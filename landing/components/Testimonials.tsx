'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Founder, TechBlog.com',
    avatar: 'SC',
    content: 'We had over 10,000 dead links that were costing us traffic and revenue. Switchboard turned them into a $2,000/month income stream. Amazing!',
    rating: 5,
    metrics: '340% ROI in 3 months',
  },
  {
    name: 'Michael Rodriguez',
    role: 'Digital Marketing Manager',
    avatar: 'MR',
    content: 'The easiest passive income solution we\'ve implemented. Set it up once and forget about it while the revenue keeps coming in.',
    rating: 5,
    metrics: '$5K/month revenue',
  },
  {
    name: 'Emily Thompson',
    role: 'Content Director, NewsDaily',
    avatar: 'ET',
    content: 'Not only are we earning from dead links, but our bounce rate dropped by 50%. Users love getting redirected to relevant content instead of 404s.',
    rating: 5,
    metrics: '50% lower bounce rate',
  },
]

const stats = [
  { value: '50M+', label: 'Links Processed' },
  { value: '$2M+', label: 'Earned by Publishers' },
  { value: '10K+', label: 'Active Websites' },
  { value: '99.9%', label: 'Uptime SLA' },
]

export default function Testimonials() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Trusted by Publishers Worldwide
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how websites are turning dead links into sustainable revenue
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-6 relative"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-gray-200" />
              
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                  <span className="text-primary font-semibold">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {testimonial.role}
                  </p>
                </div>
              </div>

              <div className="flex mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>

              <p className="text-gray-700 mb-4 italic">
                "{testimonial.content}"
              </p>

              <div className="pt-4 border-t border-gray-100">
                <span className="inline-flex items-center text-sm font-semibold text-primary">
                  {testimonial.metrics}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}