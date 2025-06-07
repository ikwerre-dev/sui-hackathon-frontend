"use client";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BiBarChart,
  BiChevronDown,
  BiChevronRight,
  BiLogOut,
  BiPackage,
  BiShoppingBag,
} from "react-icons/bi";
import { BsTruck } from "react-icons/bs";
import { CiSettings } from "react-icons/ci";
import { usePathname, useRouter } from "next/navigation";
import { CgLock } from "react-icons/cg";
import { FaBars, FaUserSecret, FaX } from "react-icons/fa6";
import Link from "next/link";
import { IconType } from "react-icons";
import Image from "next/image";
import WalletBalance from './WalletBalance';

interface SidebarProps {
  role: string | null;
}

interface NavItem {
  label: string;
  path: string;
  icon: IconType;
  children?: { label: string; path: string }[];
}

const Sidebar = ({ role }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavOpen, setNavOpen] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Automatically expand parent if child is active
  useEffect(() => {
    const navItems = getNavItems(role);
    const activeParent = navItems.find((item) =>
      item.children?.some((child) => pathname.startsWith(child.path))
    );

    if (activeParent && !expandedGroups.includes(activeParent.label)) {
      setExpandedGroups((prev) => [...prev, activeParent.label]);
    }
  }, [pathname, role]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  // Navigation items for each role
  const getNavItems = (role: string | null): NavItem[] => {
    switch (role) {
      case "seller":
        return [
          {
            label: "Overview",
            path: "/user/seller/overview",
            icon: BiBarChart,
          },
          {
            label: "Products",
            path: "/user/seller/products",
            icon: BiPackage,
            children: [
              {
                label: "Active Products",
                path: "/user/seller/products/activeproducts",
              },
              {
                label: "Add Products",
                path: "/user/seller/products/addproduct",
              },
            ],
          },
        ];

      case "logistics":
        return [
          {
            label: "Overview",
            path: "/user/logistics/overview",
            icon: BiBarChart,
          },
          {
            label: "Active Shipments",
            path: "/user/logistics/active-shipments",
            icon: BsTruck,
          },
          //   {
          //     label: "Verify & Handoff",
          //     path: "/user/logistics/verify",
          //     icon: BiPackage,
          //   },
          {
            label: "History",
            path: "/user/logistics/history",
            icon: CgLock,
          },
        ];

      case "consumer":
        return [
          {
            label: "Overview",
            path: "/user/consumer/overview",
            icon: BiBarChart,
          },
          {
            label: "My Orders",
            path: "/user/consumer/myorders",
            icon: BiShoppingBag,
          },
          {
            label: "Order History",
            path: "/user/consumer/order-history",
            icon: CgLock,
          },
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems(role);

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const hasActiveChild = (item: NavItem) => {
    return item.children?.some((child) => isActive(child.path));
  };

  const logout = () => {
    console.log("WDWD");
    localStorage.clear();
    router.replace("/");
  };

  return (
    <aside className="bg-black h-fit lg:h-screen w-full lg:w-64 border-r border-neutral-200 z-50">
      <div className="flex flex-col h-full">
        {/* Top Section */}
        <div className="flex lg:flex-col justify-between items-center">
          {/* Logo */}
          <div className="p-6 flex items-center">
            <Image
              src="/FooterLogo.png"
              width={150}
              height={150}
              alt="Tracui"
            />
          </div>

          {/* Mobile Menu Button */}
          <div className="flex justify-center items-center lg:hidden pe-6">
            <button
              onClick={() => setNavOpen(!isNavOpen)}
              className="cursor-pointer"
            >
              {!isNavOpen ? (
                <FaBars color="white" size={30} />
              ) : (
                <FaX color="white" size={25} />
              )}
            </button>
          </div>
        </div>

        {/* Main Navigation Container */}
        <div
          className={`${
            isNavOpen ? "top-24" : "-top-[100%]"
          } absolute lg:static lg:flex lg:flex-col lg:flex-grow bg-black w-full left-0 transition-all duration-300`}
        >
          {/* Navigation Items */}
          <nav className="text-white flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isParentActive = hasActiveChild(item);

                return (
                  <li key={item.label}>
                    {!item.children ? (
                      <Link
                        onClick={() => setNavOpen(false)}
                        href={item.path}
                        className={`font-semibold flex items-center px-3 py-2 rounded-lg transition-colors ${
                          isActive(item.path)
                            ? "bg-white text-black"
                            : "text-white hover:bg-gray-400 hover:text-black"
                        }`}
                      >
                        <span className="mr-3">
                          <Icon size={20} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <div>
                        <button
                          onClick={() => toggleGroup(item.label)}
                          className={`w-30 flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                            isActive(item.path) || isParentActive
                              ? "bg-white text-black"
                              : "text-white hover:bg-gray-400 hover:text-black"
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="mr-3">
                              <Icon size={20} />
                            </span>
                            <span>{item.label}</span>
                          </div>
                          {expandedGroups.includes(item.label) ||
                          isParentActive ? (
                            <BiChevronDown size={16} />
                          ) : (
                            <BiChevronRight size={16} />
                          )}
                        </button>

                        {/* Submenu */}
                        <AnimatePresence>
                          {(expandedGroups.includes(item.label) ||
                            isParentActive) && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden pl-8 flex flex-col"
                            >
                              {item.children.map((subItem, index) => (
                                <li key={subItem.label}>
                                  <Link
                                    onClick={() => setNavOpen(false)}
                                    href={subItem.path}
                                    className={`mt-2 flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                                      isActive(subItem.path)
                                        ? "bg-white text-black"
                                        : "text-white hover:bg-gray-400 hover:text-black"
                                    }`}
                                  >
                                    {subItem.label}
                                  </Link>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout Button - Fixed at bottom for desktop */}
          <div className="p-4 flex flex-col mt-auto border-t gap-3 border-neutral-200">
            <WalletBalance />
            <button
              onClick={logout}
              className="flex w-30 bg-white cursor-pointer hover:text-black hover:font-semibold items-center px-3 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <BiLogOut size={20} className="mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
