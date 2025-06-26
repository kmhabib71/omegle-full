import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import Link from "next/link";

export default function BlogPage() {
  // Sample blog posts
  const blogPosts = [
    {
      id: 1,
      slug: "maximizing-your-experience",
      title: "How to Make the Most of Your SnapPair Experience",
      excerpt:
        "Discover tips and tricks to connect with interesting people around the world.",
      date: "March 10, 2025",
      imageUrl:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dmlkZW8lMjBjaGF0fGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60",
    },
    {
      id: 2,
      slug: "cultural-exchange",
      title: "Cultural Exchange Through Video Chats",
      excerpt:
        "How SnapPair is helping people learn about different cultures around the world.",
      date: "February 28, 2025",
      imageUrl:
        "https://images.unsplash.com/photo-1509909756405-be0199881695?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Z2xvYmFsfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60",
    },
    {
      id: 3,
      slug: "upcoming-features",
      title: "New Features Coming to SnapPair",
      excerpt:
        "Exciting updates and features that will enhance your video chatting experience.",
      date: "February 20, 2025",
      imageUrl:
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dGVjaG5vbG9neXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60",
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />
      <div className="container mx-auto px-4 py-24 flex-1">
        <h1 className="text-4xl font-bold mb-8 text-center">SnapPair Blog</h1>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {blogPosts.map((post) => (
            <div
              key={post.id}
              className="bg-zinc-900 rounded-lg overflow-hidden"
            >
              <div className="h-48 overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
              <div className="p-6">
                <span className="text-gray-400 text-sm">{post.date}</span>
                <h2 className="text-xl font-bold mt-2 mb-3">{post.title}</h2>
                <p className="text-gray-300 mb-4">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.id}`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Read more →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
