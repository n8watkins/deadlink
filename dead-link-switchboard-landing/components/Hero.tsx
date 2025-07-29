'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Link2Off, DollarSign, TrendingUp } from 'lucide-react'
import { Button } from './Button'

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center rounded-full px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trusted by 10,000+ websites
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Turn Dead Links Into
            <span className="text-primary block">Revenue Streams</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Stop losing money to 404 errors. Our AI-powered switchboard automatically 
            redirects broken links to relevant content while you earn passive income.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="group">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline">
              See How It Works
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-primary mb-2">5-10%</div>
              <p className="text-gray-600">Average dead links per site</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-primary mb-2">$0.45</div>
              <p className="text-gray-600">Lost per dead link click</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-primary mb-2">340%</div>
              <p className="text-gray-600">Average ROI in 3 months</p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-3xl" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="text-sm text-gray-500">yourblog.com/broken-link</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Link2Off className="h-8 w-8 text-red-500" />
                <div>
                  <div className="text-lg font-semibold">404 Error Detected</div>
                  <div className="text-gray-600">This link leads nowhere...</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center py-4">
                <motion.div
                  animate={{ x: [0, 20, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-primary"
                >
                  <ArrowRight className="h-6 w-6" />
                </motion.div>
              </div>
              
              <div className="flex items-center space-x-4">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-lg font-semibold">Redirected & Monetized!</div>
                  <div className="text-gray-600">User sees relevant content, you earn $$$</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}