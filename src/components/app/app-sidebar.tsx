import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Mail, MessagesSquare, Search, ShieldCheck } from "lucide-react";

import logo from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const main = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Email Generator", url: "/email", icon: Mail },
  { title: "Research Assistant", url: "/research", icon: Search },
  { title: "Workplace Chatbot", url: "/chat", icon: MessagesSquare },
] as const;

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpenMobile(false)}>
          <img src={logo} alt="" width={36} height={36} className="size-9 shrink-0 rounded-xl" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="font-display text-sm font-semibold text-foreground">Pinnacle</p>
              <p className="truncate text-xs text-muted-foreground">Workplace AI Assistant</p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {main.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 rounded-lg font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link to={item.url} onClick={() => setOpenMobile(false)}>
                        <item.icon className={cn(active && "text-brand-deep")} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="rounded-xl bg-brand-soft p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground">
              <span className="size-2 rounded-full bg-success" />
              Built-in AI ready
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Powered by Lovable AI. No API key needed.
            </p>
          </div>
        ) : (
          <div className="flex justify-center" title="Responsible AI">
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
