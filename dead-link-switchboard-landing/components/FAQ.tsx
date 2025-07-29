'use client'

import { motion } from 'framer-motion'
import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'How does the revenue model work?',
    answer: 'When a user clicks on a dead link on your site, we redirect them to a relevant alternative page from our advertising partners. You earn money for each successful redirect, with revenue shares ranging from 70% to 90% depending on your plan.',
  },
  {
    question: 'Is this SEO-friendly?',
    answer: 'Absolutely! We use proper 301 redirects that preserve SEO value and comply with search engine guidelines. Our system actually improves your SEO by eliminating 404 errors that can hurt your rankings.',
  },
  {
    question: 'What about user privacy?',
    answer: 'We take privacy seriously. We\'re fully GDPR compliant and don\'t collect any personally identifiable information. Users are always notified about redirects, and you maintain complete control over your data.',
  },
  {
    question: 'How quickly can I start earning?',
    answer: 'You can start earning immediately after installation! Our system begins detecting and monetizing dead links within minutes. Most publishers see their first earnings within 24-48 hours.',
  },
  {
    question: 'Can I control which links get redirected?',
    answer: 'Yes! Our dashboard gives you complete control. You can whitelist links you don\'t want redirected, set rules for specific domains, and customize the redirect behavior to match your needs.',
  },
  {
    question: 'What if I want to cancel?',
    answer: 'You can cancel anytime with no questions asked. Simply remove our JavaScript snippet, and your links will return to their original behavior. We\'ll process any remaining earnings and send your final payout.',
  },
  {
    question: 'How are payouts handled?',
    answer: 'We offer flexible payout options including PayPal, bank transfer, and Stripe. Free plans receive monthly payouts, while paid plans can receive weekly or even daily payouts. Minimum payout threshold is just $10.',
  },
  {
    question: 'Will this slow down my website?',
    answer: 'No! Our script is optimized for performance and loads asynchronously. It\'s hosted on a global CDN and adds less than 10ms to your page load time. Most users notice their sites actually feel faster due to eliminated 404 errors.',
  },
]

export default function FAQ() {
  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about monetizing your dead links
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion.Root type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <Accordion.Item
                key={index}
                value={`item-${index}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors group">
                    <span className="text-lg font-medium text-gray-900">
                      {faq.question}
                    </span>
                    <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="px-6 pb-4 text-gray-600">
                  {faq.answer}
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-gray-600 mb-4">
            Still have questions?
          </p>
          <button className="h-12 px-8 text-lg inline-flex items-center justify-center rounded-lg font-medium transition-colors border border-gray-300 bg-transparent hover:bg-gray-100">
            Contact Support
          </button>
        </motion.div>
      </div>
    </section>
  )
}