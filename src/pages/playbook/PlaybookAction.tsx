import { Button } from '@/components/ui/button';

export default function PlaybookAction({ children, subtitle, href, onClick, disabled }: { children: React.ReactNode; subtitle?: string; href?: string; onClick?: () => void; disabled?: boolean }) {
  const content = <><span className="pb-button-copy"><span>{children}</span>{subtitle && <span>{subtitle}</span>}</span><span className="pb-button-arrow" aria-hidden="true"><span /></span></>;
  return <div className="pb-button-shell">{href ? <Button asChild className="pb-button"><a href={href} onClick={onClick}>{content}</a></Button> : <Button className="pb-button" type="button" onClick={onClick} disabled={disabled}>{content}</Button>}</div>;
}
