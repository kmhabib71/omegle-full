"use client";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Image from "next/image";

export default function ShopPage() {
  const [selectedTab, setSelectedTab] = useState<"coins" | "premium" | "boost">(
    "coins"
  );

  // Coin packages
  const coinPackages = [
    { id: 1, coins: 100, price: 4.99, popular: false, bonus: 0 },
    { id: 2, coins: 500, price: 19.99, popular: true, bonus: 50 },
    { id: 3, coins: 1000, price: 34.99, popular: false, bonus: 150 },
    { id: 4, coins: 2000, price: 59.99, popular: false, bonus: 400 },
    { id: 5, coins: 5000, price: 129.99, popular: false, bonus: 1250 },
  ];

  // Premium packages
  const premiumPackages = [
    { id: 1, months: 1, price: 9.99, popular: false, discount: 0 },
    { id: 2, months: 3, price: 24.99, popular: true, discount: 17 },
    { id: 3, months: 6, price: 39.99, popular: false, discount: 33 },
    { id: 4, months: 12, price: 69.99, popular: false, discount: 42 },
  ];

  // Boost packages
  const boostPackages = [
    { id: 1, boosts: 1, price: 2.99, popular: false },
    { id: 2, boosts: 5, price: 11.99, popular: true, discount: 20 },
    { id: 3, boosts: 10, price: 19.99, popular: false, discount: 33 },
  ];

  // Premium benefits
  const premiumBenefits = [
    {
      icon: "🌎",
      title: "Global Access",
      description: "Connect with users from any country without restrictions.",
    },
    {
      icon: "⭐",
      title: "Priority Matching",
      description: "Get matched first and be seen by more users.",
    },
    {
      icon: "🔍",
      title: "Advanced Search",
      description: "Search for users with specific interests and criteria.",
    },
    {
      icon: "📱",
      title: "Ad-Free Experience",
      description: "Enjoy SnapPair without any advertisements.",
    },
    {
      icon: "🎭",
      title: "Exclusive Filters",
      description: "Access premium camera filters and effects.",
    },
    {
      icon: "💬",
      title: "Unlimited Messages",
      description: "Send as many messages as you want with no daily limits.",
    },
  ];

  // What you can buy with coins
  const coinUsage = [
    {
      icon: "🚀",
      title: "Boost Your Profile",
      description: "Get more visibility in search results for 30 minutes.",
      price: "200 coins",
    },
    {
      icon: "🎁",
      title: "Send Virtual Gifts",
      description: "Show appreciation during video chats with virtual gifts.",
      price: "50-500 coins",
    },
    {
      icon: "💎",
      title: "Premium Filters",
      description: "Unlock special camera filters and effects.",
      price: "100 coins each",
    },
    {
      icon: "🎯",
      title: "Featured Profile",
      description: "Appear in the featured profiles section for 24 hours.",
      price: "300 coins",
    },
  ];

  const handleBuy = (type: string, id: number) => {
    // In a real app, this would open a payment flow
    alert(`This would open a payment flow for ${type} package #${id}`);
  };

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />

      <div className="container mx-auto px-4 py-20 flex-1">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">SnapPair Shop</h1>

          {/* Tabs */}
          <div className="bg-zinc-900 rounded-lg overflow-hidden mb-8">
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setSelectedTab("coins")}
                className={`flex-1 py-4 text-center ${
                  selectedTab === "coins"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2">💰</span>
                  Coins
                </span>
              </button>
              <button
                onClick={() => setSelectedTab("premium")}
                className={`flex-1 py-4 text-center ${
                  selectedTab === "premium"
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2">⭐</span>
                  Premium
                </span>
              </button>
              <button
                onClick={() => setSelectedTab("boost")}
                className={`flex-1 py-4 text-center ${
                  selectedTab === "boost"
                    ? "bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2">🚀</span>
                  Boost
                </span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Coins Tab */}
              {selectedTab === "coins" && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Buy SnapPair Coins
                    </h2>
                    <p className="text-zinc-400">
                      Purchase coins to unlock special features and send gifts
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {coinPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`bg-zinc-800 rounded-lg p-5 border-2 ${
                          pkg.popular ? "border-blue-500" : "border-transparent"
                        } relative transition-all hover:border-blue-500`}
                      >
                        {pkg.popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-xs font-bold text-white px-3 py-1 rounded-full">
                            BEST VALUE
                          </div>
                        )}
                        <div className="flex items-center justify-center mb-4">
                          <div className="text-5xl font-bold text-white">
                            {pkg.coins}
                          </div>
                          <div className="ml-2">
                            <div className="text-yellow-500 text-2xl">💰</div>
                          </div>
                        </div>
                        {pkg.bonus > 0 && (
                          <div className="bg-blue-900/30 text-blue-400 text-xs py-1 rounded-full text-center mb-3">
                            +{pkg.bonus} BONUS COINS
                          </div>
                        )}
                        <div className="text-center text-white text-xl font-bold mb-4">
                          ${pkg.price.toFixed(2)}
                        </div>
                        <Button
                          onClick={() => handleBuy("coin", pkg.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                        >
                          Buy Now
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-zinc-800 rounded-lg p-6 mb-8">
                    <h3 className="text-xl font-bold text-white mb-4">
                      What You Can Buy With Coins
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {coinUsage.map((item, index) => (
                        <div
                          key={index}
                          className="flex p-3 bg-zinc-900 rounded-lg"
                        >
                          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-2xl">
                            {item.icon}
                          </div>
                          <div className="ml-3">
                            <h4 className="text-white font-medium">
                              {item.title}
                            </h4>
                            <p className="text-sm text-zinc-400">
                              {item.description}
                            </p>
                            <div className="mt-1 text-sm text-yellow-500 font-medium">
                              {item.price}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Premium Tab */}
              {selectedTab === "premium" && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Upgrade to SnapPair Premium
                    </h2>
                    <p className="text-zinc-400">
                      Unlock exclusive features and enhance your SnapPair
                      experience
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {premiumPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`bg-zinc-800 rounded-lg p-5 border-2 ${
                          pkg.popular
                            ? "border-yellow-500"
                            : "border-transparent"
                        } relative transition-all hover:border-yellow-500`}
                      >
                        {pkg.popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-xs font-bold text-black px-3 py-1 rounded-full">
                            MOST POPULAR
                          </div>
                        )}
                        <div className="text-center mb-3">
                          <div className="text-zinc-400 uppercase text-xs font-medium">
                            {pkg.months === 1
                              ? "Monthly"
                              : pkg.months === 3
                              ? "Quarterly"
                              : pkg.months === 6
                              ? "Semi-Annual"
                              : "Annual"}
                          </div>
                          <div className="text-2xl font-bold text-white mt-2">
                            {pkg.months} {pkg.months === 1 ? "Month" : "Months"}
                          </div>
                        </div>
                        {pkg.discount > 0 && (
                          <div className="bg-yellow-900/30 text-yellow-400 text-xs py-1 rounded-full text-center mb-3">
                            SAVE {pkg.discount}%
                          </div>
                        )}
                        <div className="text-center mb-3">
                          <span className="text-white text-2xl font-bold">
                            ${pkg.price.toFixed(2)}
                          </span>
                          {pkg.months > 1 && (
                            <span className="text-zinc-400 text-xs ml-1">
                              (${(pkg.price / pkg.months).toFixed(2)}/mo)
                            </span>
                          )}
                        </div>
                        <Button
                          onClick={() => handleBuy("premium", pkg.id)}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-3"
                        >
                          Subscribe
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-yellow-900/30 to-yellow-700/20 rounded-lg p-6 mb-8 border border-yellow-500/30">
                    <h3 className="text-xl font-bold text-white mb-4">
                      Premium Benefits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {premiumBenefits.map((benefit, index) => (
                        <div
                          key={index}
                          className="flex p-3 bg-zinc-900/70 rounded-lg"
                        >
                          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-2xl">
                            {benefit.icon}
                          </div>
                          <div className="ml-3">
                            <h4 className="text-white font-medium">
                              {benefit.title}
                            </h4>
                            <p className="text-sm text-zinc-400">
                              {benefit.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Boost Tab */}
              {selectedTab === "boost" && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Boost Your Visibility
                    </h2>
                    <p className="text-zinc-400">
                      Get more matches by boosting your profile to the top
                    </p>
                  </div>

                  <div className="max-w-3xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      {boostPackages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className={`bg-zinc-800 rounded-lg p-5 border-2 ${
                            pkg.popular
                              ? "border-green-500"
                              : "border-transparent"
                          } relative transition-all hover:border-green-500`}
                        >
                          {pkg.popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-xs font-bold text-black px-3 py-1 rounded-full">
                              TOP CHOICE
                            </div>
                          )}
                          <div className="text-center mb-3">
                            <div className="text-4xl font-bold text-white mt-2">
                              {pkg.boosts} <span className="text-2xl">🚀</span>
                            </div>
                            <div className="text-zinc-400 text-sm mt-1">
                              {pkg.boosts === 1 ? "Boost" : "Boosts"}
                            </div>
                          </div>
                          {pkg.discount && (
                            <div className="bg-green-900/30 text-green-400 text-xs py-1 rounded-full text-center mb-3">
                              SAVE {pkg.discount}%
                            </div>
                          )}
                          <div className="text-center text-white text-xl font-bold mb-4">
                            ${pkg.price.toFixed(2)}
                          </div>
                          <Button
                            onClick={() => handleBuy("boost", pkg.id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                          >
                            Buy Now
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="bg-zinc-800 rounded-lg overflow-hidden mb-8">
                      <div className="bg-gradient-to-r from-green-900/30 to-teal-900/30 p-6">
                        <h3 className="text-xl font-bold text-white mb-2">
                          How Boost Works
                        </h3>
                        <p className="text-zinc-400">
                          Get up to 10x more profile views for 30 minutes
                        </p>
                      </div>
                      <div className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between">
                          <div className="text-center mb-4 md:mb-0">
                            <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center text-3xl mx-auto">
                              🚀
                            </div>
                            <p className="text-zinc-300 mt-2">Activate Boost</p>
                          </div>
                          <div className="text-zinc-600 my-2 md:my-0">➜</div>
                          <div className="text-center mb-4 md:mb-0">
                            <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center text-3xl mx-auto">
                              👀
                            </div>
                            <p className="text-zinc-300 mt-2">More Views</p>
                          </div>
                          <div className="text-zinc-600 my-2 md:my-0">➜</div>
                          <div className="text-center mb-4 md:mb-0">
                            <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center text-3xl mx-auto">
                              💬
                            </div>
                            <p className="text-zinc-300 mt-2">More Matches</p>
                          </div>
                          <div className="text-zinc-600 my-2 md:my-0">➜</div>
                          <div className="text-center">
                            <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center text-3xl mx-auto">
                              🎯
                            </div>
                            <p className="text-zinc-300 mt-2">
                              More Connections
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Payment Methods */}
              <div className="border-t border-zinc-800 pt-6 mt-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Accepted Payment Methods
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white p-2 rounded h-8 w-12 flex items-center justify-center">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png"
                      alt="Mastercard"
                      className="h-6"
                    />
                  </div>
                  <div className="bg-white p-2 rounded h-8 w-12 flex items-center justify-center">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/1280px-Visa_Inc._logo.svg.png"
                      alt="Visa"
                      className="h-6"
                    />
                  </div>
                  <div className="bg-white p-2 rounded h-8 w-12 flex items-center justify-center">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1280px-PayPal.svg.png"
                      alt="PayPal"
                      className="h-6"
                    />
                  </div>
                  <div className="bg-white p-2 rounded h-8 w-12 flex items-center justify-center">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/ApplePay_Logo.svg/1280px-ApplePay_Logo.svg.png"
                      alt="Apple Pay"
                      className="h-6"
                    />
                  </div>
                  <div className="bg-white p-2 rounded h-8 w-12 flex items-center justify-center">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Google_Pay_Logo.svg/1280px-Google_Pay_Logo.svg.png"
                      alt="Google Pay"
                      className="h-6"
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-4">
                  *All transactions are secure and encrypted. By making a
                  purchase, you agree to our Terms of Service and Privacy
                  Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
