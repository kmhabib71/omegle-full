import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />
      <div className="container mx-auto px-4 py-24 flex-1">
        <h1 className="text-4xl font-bold mb-8 text-center">About SnapPair</h1>
        <div className="max-w-4xl mx-auto bg-zinc-900 rounded-lg p-8">
          <p className="text-lg mb-6">
            SnapPair is a leading global video chat platform for online meeting
            experiences (OME). Discover 1v1 video chat for instant connections
            with new people from around the world.
          </p>
          <p className="text-lg mb-6">
            With millions of users worldwide, SnapPair provides a safe and fun
            environment to meet new friends, practice languages, or just chat
            with interesting people from diverse backgrounds.
          </p>
          <p className="text-lg mb-6">
            Our advanced matching algorithm helps you find people who share your
            interests, and our intuitive interface makes video chatting with
            strangers easier than ever.
          </p>
          <p className="text-lg">
            SnapPair is owned by Hyperconnect, part of the Match Group family of
            brands.
          </p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
