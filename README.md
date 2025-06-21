# Omegle Clone - Landing Page

A beautiful and responsive landing page for an Omegle clone built with Next.js 15 and Tailwind CSS.

## Features

- 🎨 **Modern Design**: Clean and responsive UI that works great on desktop and mobile
- 🇺🇸 **Dynamic Flag Background**: Animated American flag in the public service announcement section
- 📱 **Mobile Responsive**: Optimized for all screen sizes
- ⚡ **Fast Loading**: Built with Next.js 15 for optimal performance
- 🎭 **Interactive Elements**: Hover effects and smooth transitions
- 🔒 **Safety Features**: Prominent safety warnings and age restrictions

## Screenshots

The landing page includes:

- Header with mobile compatibility message
- Public service announcement with flag background
- Main content explaining Omegle functionality
- Safety warnings and age verification
- Interactive chat interface with Text/Video options
- Interest input field
- Additional chat options (College student, Spy mode, etc.)

## Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React**: Component-based UI library

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Navigate to the project directory:

   ```bash
   cd omegle-clone
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
omegle-clone/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout component
│   │   ├── page.tsx            # Main landing page
│   │   └── globals.css         # Global styles
│   └── components/             # Reusable components
├── public/                     # Static assets
├── package.json
└── README.md
```

## Customization

### Colors

The project uses a patriotic color scheme with:

- Red: `#DC2626` (red-600)
- Blue: `#1E40AF` (blue-800)
- White: `#FFFFFF`
- Yellow: `#FCD34D` (yellow-300)

### Typography

- Primary font: Geist Sans
- Monospace font: Geist Mono

### Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## Features Implementation

### Public Service Announcement

- Dynamic American flag background with stars and stripes
- Animated text with drop shadows
- Responsive design that adapts to screen size

### Chat Interface

- Two-column layout on desktop, stacked on mobile
- Interactive buttons with hover effects
- Interest input field with focus states
- Preset chat options

### Safety Features

- Prominent video monitoring notice
- Age verification requirements
- Safety warnings throughout the content

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes only. Please respect the original Omegle terms of service and create responsible chat applications.

## Deployment

The project can be deployed on:

- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Any platform supporting Node.js

## Support

For questions or issues, please open an issue in the repository or contact the development team.

---

**Note**: This is a clone/recreation of the Omegle landing page for educational purposes. Please ensure you comply with all applicable laws and regulations when creating chat applications.
