'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Link2Off, DollarSign, TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react'
import { Button } from '@/components/Button'
import Hero from '@/components/Hero'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import Testimonials from '@/components/Testimonials'
import FAQ from '@/components/FAQ'
import Footer from '@/components/Footer'
import Navigation from '@/components/Navigation'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navigation />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <Testimonials />
      <FAQ />
      <Footer />
    </main>
  )
}