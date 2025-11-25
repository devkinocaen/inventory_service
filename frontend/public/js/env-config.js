window.ENV = {
  APP_NAME: "Costumerie",
  APP_VERSION: "MultiDeploy",
  DB_CLIENT: "",
  BASE_PATH: "",

  // Variables spécifiques à chaque site Vercel
  DB_NAME: "",
  HEADER_IMAGE_URL: "./images/bandeau_costumerie_julie.png",

  // URLs API déjà présentes dans ta version
  API_REST_URLS: [
    "http://127.0.0.1:5000",
    "https://inventory-service.alwaysdata.net",
    "https://inventory-service-tz0g.onrender.com"
  ],

  SERVICE_WAKEUP_INTERVAL: 720
};
