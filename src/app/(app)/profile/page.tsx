import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { getProfile } from "@/lib/queries/users";
import { LogoutButton, PasswordForm, PhotoPicker, UsernameForm } from "./ProfileForms";

export const metadata: Metadata = { title: "Perfil · ZamparTube" };

export default async function ProfilePage() {
  const profile = await getProfile(getDb(), await requireUserId());
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Perfil</h1>

      <section aria-labelledby="photo" className="mb-6 flex items-center gap-5 rounded-2xl bg-surface p-5">
        <ChannelAvatar src={profile.imageSrc} name={profile.username} size={80} />
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id="photo" className="truncate text-lg font-medium">
            {profile.username}
          </h2>
          <PhotoPicker hasImage={!!profile.imageSrc} />
        </div>
      </section>

      <section aria-labelledby="name" className="mb-6 rounded-2xl bg-surface p-5">
        <h2 id="name" className="mb-4 font-medium">
          Nome de usuário
        </h2>
        <UsernameForm username={profile.username} />
      </section>

      <section aria-labelledby="pass" className="mb-6 rounded-2xl bg-surface p-5">
        <h2 id="pass" className="mb-4 font-medium">
          Senha
        </h2>
        <PasswordForm />
      </section>

      <LogoutButton />
    </div>
  );
}
