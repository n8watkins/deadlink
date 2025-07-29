# Dead Links Switchboard - Landing Page

A high-converting landing page for a dead links monetization service built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🚀 Modern, responsive design optimized for conversions
- 🎨 Smooth animations with Framer Motion
- 📱 Mobile-first approach
- ⚡ Lightning-fast performance with Next.js 15
- 🎯 SEO optimized
- 💅 Tailwind CSS for styling

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
cd deadlinks-switchboard
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Project Structure

```
deadlinks-switchboard/
├── app/
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   ├── Button.tsx      # Reusable button component
│   ├── Navigation.tsx  # Top navigation
│   ├── Hero.tsx        # Hero section
│   ├── HowItWorks.tsx  # How it works section
│   ├── Features.tsx    # Features grid
│   ├── Pricing.tsx     # Pricing plans
│   ├── Testimonials.tsx # Customer testimonials
│   ├── FAQ.tsx         # Frequently asked questions
│   └── Footer.tsx      # Footer component
├── lib/
│   └── utils.ts        # Utility functions
└── public/             # Static assets
```

## Key Sections

1. **Hero Section**: Eye-catching headline with value proposition and CTAs
2. **How It Works**: 4-step process explanation
3. **Features Grid**: 12 key features highlighting the service benefits
4. **Pricing**: Three-tier pricing structure (Starter, Professional, Enterprise)
5. **Testimonials**: Social proof with customer success stories
6. **FAQ**: Common questions answered
7. **Footer**: Comprehensive footer with links and social media

## Customization

- **Colors**: Edit the color palette in `tailwind.config.js`
- **Content**: Update text content in individual component files
- **Fonts**: Modify font settings in `app/layout.tsx`
- **Components**: All components are modular and easy to customize

## Building for Production

```bash
npm run build
npm start
```

## Deployment

The site is optimized for deployment on Vercel:

```bash
npm install -g vercel
vercel
```

## Performance Optimizations

- Lazy loading of components
- Optimized images and assets
- Minimal JavaScript bundle
- Server-side rendering with Next.js
- Efficient CSS with Tailwind

## Next Steps

To complete the implementation:

1. Add the revenue calculator interactive widget
2. Implement link checker demo functionality
3. Connect contact forms to backend
4. Add analytics tracking (GA4, Hotjar)
5. Implement A/B testing
6. Set up payment processing with Stripe
7. Create dashboard preview component

## License

This project is licensed under the MIT License.