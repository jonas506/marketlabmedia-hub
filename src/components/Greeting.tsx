import { format } from "date-fns";
import { de } from "date-fns/locale";

interface GreetingProps {
  name: string | null | undefined;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 14) return "Mahlzeit";
  if (hour < 18) return "Guten Nachmittag";
  return "Guten Abend";
};

const Greeting: React.FC<GreetingProps> = ({ name }) => {
  const greeting = getGreeting();
  const dateStr = format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de });

  return (
    <div className="mb-8">
      <h1 className="text-xl font-bold tracking-tight">
        {greeting}{name ? `, ${name}` : ""}
      </h1>
      <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
    </div>
  );
};

export default Greeting;
