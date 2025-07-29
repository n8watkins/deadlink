'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, X, Link2Off } from 'lucide-react'
import { Button } from './Button'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { label: 'How it Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link2Off className="h-8 w-8 text-primary mr-2" />
            <span className="text-xl font-bold">Switchboard</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-gray-700 hover:text-primary transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Button size="sm">Start Free Trial</Button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b"
        >
          <div className="px-4 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block px-3 py-2 text-gray-700 hover:text-primary"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Button className="w-full mt-4" size="sm">
              Start Free Trial
            </Button>
          </div>
        </motion.div>
      )}
    </nav>
  )
}