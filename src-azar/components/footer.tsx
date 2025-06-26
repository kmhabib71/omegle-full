import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-black text-white pt-10 pb-5">
      <div className="container mx-auto px-4">
        {/* Logo Section */}
        <div className="flex flex-col items-center justify-center mb-6">
          <Link href="/" className="mb-2">
            <div className="text-center">
              <span className="uppercase text-xl font-bold tracking-wider">
                SnapPair
              </span>
              <sup>®</sup>
            </div>
          </Link>
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-wide">
              MATCH GROUP FAMILY
            </span>
          </div>
        </div>

        {/* Links Section */}
        <div className="flex flex-wrap justify-center text-center gap-2 mb-4">
          <Link href="/about" className="text-white hover:text-gray-300 px-2">
            About SnapPair
          </Link>

          <span className="text-gray-500">|</span>
          <Link href="/guide" className="text-white hover:text-gray-300 px-2">
            snappair Guide
          </Link>
          <span className="text-gray-500">|</span>
          <Link
            href="/guidelines"
            className="text-white hover:text-gray-300 px-2"
          >
            Community Guidelines
          </Link>
        </div>

        <div className="flex flex-wrap justify-center text-center gap-2 mb-6">
          <Link href="/terms" className="text-white hover:text-gray-300 px-2">
            Terms
          </Link>
          <span className="text-gray-500">|</span>
          <Link
            href="/privacy"
            className="text-white hover:text-gray-300 font-bold px-2"
          >
            Privacy
          </Link>
        </div>

        <div className="flex flex-wrap justify-center text-center gap-2 mb-6">
          <Link href="/ccpa" className="text-white hover:text-gray-300 px-2">
            CCPA Addendum
          </Link>
        </div>

        <div className="flex flex-wrap justify-center text-center gap-2 mb-6">
          <Link href="/support" className="text-white hover:text-gray-300 px-2">
            Customer Service
          </Link>
        </div>

        <div className="flex flex-wrap justify-center text-center gap-2 mb-8">
          <Link href="/cookies" className="text-white hover:text-gray-300 px-2">
            Cookie Policy
          </Link>
          <button className="text-white hover:text-gray-300 px-2">
            Your Privacy Choices
          </button>
        </div>

        {/* Company Info */}
        <div className="text-center text-sm text-gray-400 mb-2">
          <p>CEO : Jett Ledbetter</p>
          <p>email : snappairllc@gmail.com</p>
          <p>Address : Oclahoma, USA</p>
        </div>

        <div className="text-center text-sm text-gray-400 mb-8">
          <p>© 2025 SnapPair LLC. All rights reserved.</p>
        </div>

        {/* App Store Links */}
        <div className="flex justify-center gap-4 mb-8">
          <Link
            href="https://apps.apple.com/us/app/snappair"
            className="bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-5 rounded-md flex items-center"
          >
            <span className="mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"></path>
                <path d="M12 15.5c1.9 0 3.5-1.6 3.5-3.5s-1.6-3.5-3.5-3.5-3.5 1.6-3.5 3.5 1.6 3.5 3.5 3.5z"></path>
              </svg>
            </span>
            App Store
          </Link>
          <Link
            href="https://play.google.com/store/apps/details?id=com.snappair.app"
            className="bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-5 rounded-md flex items-center"
          >
            <span className="mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </span>
            Google Play
          </Link>
        </div>

        {/* Social Links */}
        <div className="flex justify-center gap-6">
          <Link
            href="https://www.instagram.com/snappair_official/"
            className="text-white hover:text-gray-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
            </svg>
          </Link>
          <Link
            href="https://www.facebook.com/snappair.app/"
            className="text-white hover:text-gray-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
            </svg>
          </Link>
          <Link
            href="https://www.youtube.com/c/OfficialSnapPair/videos"
            className="text-white hover:text-gray-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"></path>
              <path d="m10 15 5-3-5-3z"></path>
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  );
}
