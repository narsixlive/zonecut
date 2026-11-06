export interface TourStep {
  id: string;
  target: string | null;
  title: string;
  description: string;
  tips?: string[];
  position: "center" | "top" | "bottom" | "left" | "right";
}

// ZoneScene studio: steps describe only what the studio shows (zonescene/studio-scope.ts).
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Bienvenue dans le studio",
    description:
      "Petit tour de l’écran : tes fichiers à gauche, le lecteur au centre, la timeline en bas, les réglages à droite.",
    position: "center",
  },
  {
    id: "assets",
    target: "[data-tour='assets']",
    title: "Médias et texte",
    description:
      "Importe tes vidéos, ta musique et tes images ici, ou ajoute un texte. Glisse-les ensuite sur la timeline.",
    tips: [
      "Médias : vidéos, sons et images importés",
      "Texte : titres et sous-titres",
      "Glisse un élément sur la timeline pour l’utiliser",
    ],
    position: "right",
  },
  {
    id: "timeline",
    target: "[data-tour='timeline']",
    title: "Timeline",
    description:
      "Place tes clips sur les pistes, raccourcis-les par les bords, coupe-les et zoome avec les commandes à droite.",
    tips: [
      "S coupe le clip sélectionné",
      "Tire le bord d’un clip pour le raccourcir",
      "Ajoute une piste quand il te faut une couche de plus",
    ],
    position: "top",
  },
  {
    id: "preview",
    target: "[data-tour='preview']",
    title: "Lecteur",
    description:
      "Le lecteur montre l’image en cours. Le cadre rouge, c’est la zone que les boutons de Reels et TikTok ne cachent pas : garde ton texte dedans.",
    tips: [
      "Lecture et pause sous l’image",
      "Le bouton des marges affiche ou cache le cadre rouge",
    ],
    position: "left",
  },
  {
    id: "inspector",
    target: "[data-tour='inspector']",
    title: "Réglages",
    description:
      "Sélectionne un clip pour régler sa taille, sa position, son volume, ses sous-titres ou le calage sur le tempo de la musique.",
    position: "left",
  },
  {
    id: "complete",
    target: null,
    title: "C’est parti",
    description:
      "Quand c’est prêt, clique sur Exporter en haut à droite : tu récupères un MP4 prêt à poster.",
    position: "center",
  },
];

export const ONBOARDING_KEY = "openreel-onboarding-complete";
