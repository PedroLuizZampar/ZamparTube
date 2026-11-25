"use client";

import Link from "next/link";
import * as DM from "@radix-ui/react-dropdown-menu";
import { LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { ChannelAvatar } from "./ChannelAvatar";
import { menuContentClass, menuItemClass } from "./ui/menu-styles";

export interface Account {
  username: string;
  /** Profile photo URL, or "" (then the initial is shown). */
  imageSrc: string;
}

/**
 * The signed-in user's photo, opening "Perfil" and "Sair". The last row of the sidebar (photo only when the sidebar
 * is collapsed), or the rightmost button of the phone header (`compact`).
 */
export function AccountMenu({
  account,
  compact = false,
  collapsed = false,
}: {
  account: Account;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const iconOnly = compact || collapsed;
  return (
    <DM.Root modal={false}>
      <DM.Trigger
        aria-label={`Conta: ${account.username}`}
        title={iconOnly ? account.username : undefined}
        className={`flex items-center gap-3 rounded-full text-sm font-medium text-muted outline-none transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface data-[state=open]:text-text ${
          compact ? "h-9 w-9 justify-center" : collapsed ? "mx-auto h-11 w-11 justify-center" : "w-full p-1.5 pr-3"
        }`}
      >
        <ChannelAvatar src={account.imageSrc} name={account.username} size={32} />
        {!iconOnly && <span className="min-w-0 flex-1 truncate text-left">{account.username}</span>}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          side={compact ? "bottom" : "top"}
          align={compact ? "end" : "start"}
          sideOffset={6}
          collisionPadding={12}
          className={`${menuContentClass} min-w-52`}
        >
          <DM.Label className="truncate px-3 py-2 text-xs text-muted">
            Conectado como <span className="font-medium text-text">{account.username}</span>
          </DM.Label>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item asChild className={`${menuItemClass} pl-3`}>
            <Link href="/profile">
              <UserRound className="h-4 w-4" strokeWidth={1.75} /> Perfil
            </Link>
          </DM.Item>
          <DM.Item className={`${menuItemClass} pl-3`} onSelect={() => void logoutAction()}>
            <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sair
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
