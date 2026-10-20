export interface Texts {
  title: string;
  subtitle: string;
  runBenchmark: string;
  smoothing: string;
  levels: string[];
  wireframe: string;
  material: string;
  resolution: string;
  shadows: string;
  antialias: string;
  postProcess: string;
  clones: string;
  autoOrbit: string;
  orbitSpeed: string;
  resetCam: string;
  hideHud: string;
  showHud: string;
  resLabel: string;
  trisLabel: string;
  vertsLabel: string;
  drawsLabel: string;
  levelLabel: string;
  padsLabel: string;
  bmTitle: string;
  bmDesc: string;
  bmResult: string;
  bmClose: string;
  bmRerun: string;
  menuBenchmark: string;
  menu1080: string;
  menu720: string;
  menuResetCam: string;
  menuToggleHud: string;
}

export const I18N: Record<string, Texts> = {
  en: {
    title: 'WebGL Benchmark',
    subtitle: 'Loop Subdivision & Stress Engine',
    runBenchmark: '⚡ RUN BENCHMARK (15s)',
    smoothing: 'Character Smoothing',
    levels: ['Level 0 (Low-Poly)', 'Level 1 (Beveled)', 'Level 2 (Smooth)', 'Level 3 (High-Poly)', 'Level 4 (Ultra)'],
    wireframe: 'Wireframe Mesh',
    material: 'Material Surface',
    resolution: 'Target Resolution',
    shadows: 'Shadow Quality',
    antialias: 'Hardware Anti-Aliasing',
    postProcess: 'Post-Processing (Bloom)',
    clones: 'Stress Clones Army',
    autoOrbit: 'Auto-Orbit Camera',
    orbitSpeed: 'Orbit Speed',
    resetCam: '↺ Reset Camera View',
    hideHud: '👁 Hide HUD',
    showHud: '👁 Show HUD',
    resLabel: 'Resolution',
    trisLabel: 'Triangles',
    vertsLabel: 'Vertices',
    drawsLabel: 'Draw Calls',
    levelLabel: 'Subdiv Level',
    padsLabel: 'Controllers',
    bmTitle: 'GPU Stress Benchmark',
    bmDesc: 'Testing geometry subdivision, fillrate, and shadow cascades...',
    bmResult: 'Benchmark Result',
    bmClose: 'Close & Inspect',
    bmRerun: 'Rerun Test',
    menuBenchmark: 'Run Benchmark',
    menu1080: 'Set 1080p',
    menu720: 'Set 720p',
    menuResetCam: 'Reset Camera',
    menuToggleHud: 'Toggle HUD'
  },
  fr: {
    title: 'Benchmark WebGL',
    subtitle: 'Subdivision Loop & Test de charge',
    runBenchmark: '⚡ LANCER BENCHMARK (15s)',
    smoothing: 'Lissage du personnage',
    levels: ['Niveau 0 (Bas-Poly)', 'Niveau 1 (Biseauté)', 'Niveau 2 (Lisse)', 'Niveau 3 (Haut-Poly)', 'Niveau 4 (Ultra)'],
    wireframe: 'Maillage filaire',
    material: 'Surface du matériau',
    resolution: 'Résolution cible',
    shadows: 'Qualité des ombres',
    antialias: 'Anticrénelage matériel',
    postProcess: 'Post-traitement (Bloom)',
    clones: 'Armée de clones',
    autoOrbit: 'Orbite auto caméra',
    orbitSpeed: 'Vitesse orbite',
    resetCam: '↺ Réinitialiser caméra',
    hideHud: '👁 Masquer HUD',
    showHud: '👁 Afficher HUD',
    resLabel: 'Résolution',
    trisLabel: 'Triangles',
    vertsLabel: 'Sommets',
    drawsLabel: 'Appels rendu',
    levelLabel: 'Subdivision',
    padsLabel: 'Manettes',
    bmTitle: 'Benchmark GPU',
    bmDesc: 'Test de subdivision géométrique et ombres...',
    bmResult: 'Résultat Benchmark',
    bmClose: 'Fermer & Inspecter',
    bmRerun: 'Relancer',
    menuBenchmark: 'Lancer Benchmark',
    menu1080: 'Mode 1080p',
    menu720: 'Mode 720p',
    menuResetCam: 'Réinitialiser caméra',
    menuToggleHud: 'Afficher/Masquer HUD'
  },
  es: {
    title: 'Benchmark WebGL',
    subtitle: 'Subdivisión Loop y Prueba de Estrés',
    runBenchmark: '⚡ INICIAR BENCHMARK (15s)',
    smoothing: 'Suavizado de personaje',
    levels: ['Nivel 0 (Bajo-Poly)', 'Nivel 1 (Biselado)', 'Nivel 2 (Suave)', 'Nivel 3 (Alto-Poly)', 'Nivel 4 (Ultra)'],
    wireframe: 'Malla de alambre',
    material: 'Superficie de material',
    resolution: 'Resolución objetivo',
    shadows: 'Calidad de sombras',
    antialias: 'Antialiasing por hardware',
    postProcess: 'Post-procesado (Bloom)',
    clones: 'Ejército de clones',
    autoOrbit: 'Órbita automática',
    orbitSpeed: 'Velocidad de órbita',
    resetCam: '↺ Reiniciar cámara',
    hideHud: '👁 Ocultar HUD',
    showHud: '👁 Mostrar HUD',
    resLabel: 'Resolución',
    trisLabel: 'Triángulos',
    vertsLabel: 'Vértices',
    drawsLabel: 'Llamadas',
    levelLabel: 'Subdivisión',
    padsLabel: 'Mandos',
    bmTitle: 'Benchmark de GPU',
    bmDesc: 'Probando subdivisión geométrica y sombras...',
    bmResult: 'Resultado del Benchmark',
    bmClose: 'Cerrar e Inspeccionar',
    bmRerun: 'Repetir prueba',
    menuBenchmark: 'Iniciar Benchmark',
    menu1080: 'Fijar 1080p',
    menu720: 'Fijar 720p',
    menuResetCam: 'Reiniciar cámara',
    menuToggleHud: 'Alternar HUD'
  },
  ar: {
    title: 'اختبار WebGL ثلاثي الأبعاد',
    subtitle: 'تقسيم الأسطح واختبار الأداء',
    runBenchmark: '⚡ بدء اختبار الأداء (15 ث)',
    smoothing: 'تنعيم المجسم',
    levels: ['مستوى 0 (مكعبات)', 'مستوى 1 (مشطوف)', 'مستوى 2 (ناعم)', 'مستوى 3 (عالي الدقة)', 'مستوى 4 (فائق)'],
    wireframe: 'شبكة الخطوط',
    material: 'سطح المعدن',
    resolution: 'دقة العرض',
    shadows: 'جودة الظلال',
    antialias: 'تنعيم الحواف',
    postProcess: 'تأثيرات الإضاءة (Bloom)',
    clones: 'عدد المجسمات',
    autoOrbit: 'دوران تلقائي للكاميرا',
    orbitSpeed: 'سرعة الدوران',
    resetCam: '↺ إعادة ضبط الكاميرا',
    hideHud: '👁 إخفاء اللوحة',
    showHud: '👁 إظهار اللوحة',
    resLabel: 'الدقة',
    trisLabel: 'المثلثات',
    vertsLabel: 'الرؤوس',
    drawsLabel: 'نداءات الرسم',
    levelLabel: 'المستوى',
    padsLabel: 'أذرع التحكم',
    bmTitle: 'اختبار إجهاد المعالج الرسومي',
    bmDesc: 'جارٍ فحص تقسيم المضلعات والظلال ومعدل الإطارات...',
    bmResult: 'نتيجة الاختبار',
    bmClose: 'إغلاق ومعاينة',
    bmRerun: 'إعادة الاختبار',
    menuBenchmark: 'بدء الاختبار',
    menu1080: 'دقة 1080p',
    menu720: 'دقة 720p',
    menuResetCam: 'إعادة ضبط الكاميرا',
    menuToggleHud: 'إظهار/إخفاء اللوحة'
  }
};
