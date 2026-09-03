type Props = {
  className?: string;
  alt?: string;
};

export function Logo({ className, alt = "ClubCarder logo" }: Props) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      width={64}
      height={64}
      className={className}
      draggable={false}
    />
  );
}
