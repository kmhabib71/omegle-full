import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import { Collection, ObjectId } from "mongodb";
import bcrypt from "bcrypt";

// Get User collection
const getUserCollection = async (): Promise<Collection> => {
  const client = await clientPromise;
  return client.db().collection("users");
};

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          username: profile.email.split("@")[0],
        };
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Username and password are required");
        }

        try {
          const users = await getUserCollection();
          const user = await users.findOne({ username: credentials.username });

          if (!user) {
            throw new Error("User not found");
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            throw new Error("Invalid password");
          }

          // Update online status
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                onlineStatus: true,
                lastActive: new Date(),
              },
            }
          );

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            username: user.username,
            image: user.image,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
      }
      return session;
    },
    async signIn({ user, account, profile, email }) {
      try {
        // For Google sign-in, ensure user has required fields like username
        if (account?.provider === "google") {
          const users = await getUserCollection();

          // Check if user exists by email
          const existingUser = await users.findOne({ email: user.email });

          if (existingUser) {
            // Update existing user with Google info if needed
            await users.updateOne(
              { email: user.email },
              {
                $set: {
                  onlineStatus: true,
                  lastActive: new Date(),
                  image: user.image || existingUser.image,
                  // If user signed up with credentials but is now using Google, mark as Google user too
                  signInMethod:
                    existingUser.signInMethod === "credentials"
                      ? "credentials+google"
                      : "google",
                },
              }
            );
            return true;
          } else {
            // Create a new user with default values for Google sign-ins
            const client = await clientPromise;
            const filtersCollection = client.db().collection("filters");

            // Use email username or generate random username
            const emailUsername = user.email?.split("@")[0] || "";
            const randomUsername = `user_${Math.random()
              .toString(36)
              .substring(2, 10)}`;

            // Check if the email-based username already exists
            const usernameExists = await users.findOne({
              username: emailUsername,
            });

            const finalUsername = usernameExists
              ? randomUsername
              : emailUsername;

            // Create user document
            const result = await users.insertOne({
              name: user.name,
              email: user.email,
              username: finalUsername,
              image: user.image,
              onlineStatus: true,
              lastActive: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              // Google users don't have a password in our system
              signInMethod: "google",
            });

            // Create default filter preferences
            await filtersCollection.insertOne({
              userId: result.insertedId.toString(),
              gender: "all",
              ageMin: 18,
              ageMax: 99,
              countries: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            return true;
          }
        }
        return true;
      } catch (error) {
        console.error("Sign in error:", error);
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
      // Handle redirect after successful authentication
      // If url is relative, prepend baseUrl
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // If url is on the same origin, allow it
      else if (new URL(url).origin === baseUrl) {
        return url;
      }
      // Otherwise, redirect to home page
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
    newUser: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  // Let NextAuth automatically determine the URL from the request
  // This works better with Railway and other hosting platforms
};

export default NextAuth(authOptions);
