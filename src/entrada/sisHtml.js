// Abertura SIS⁺ (Marcio, 21/11/2026): estrutura da órbita, da ignição, da História da Moked e do Universo SIS⁺.
// Textos e marcos da História vêm do briefing do Marcio e ainda pedem validação da diretoria.
export const HTML_SIS = `<div class="sisx" id="sisx">
<div id="sis" class="sis" role="application" aria-label="SIS⁺, Sistema Integrado de Segurança. Segure um ícone para conhecer; segure o MOKED para ver a história. Enter entra nas Áreas.">
  <canvas id="bk"></canvas>
  <div class="sis-ghost" aria-hidden="true"><div class="ring"></div><svg viewBox="0 0 300 300"><g class="g-ticks"></g><g style="filter:drop-shadow(0 0 4px #fff8)" opacity=".5"><line class="g-aL" stroke="#f3f4f6" stroke-width="3" stroke-linecap="round"></line><polygon class="g-aP" fill="#f3f4f6"></polygon></g></svg></div>
  <canvas id="pl"></canvas>
  <div class="sis-corpo" id="corpo">
    <svg class="sis-fx" aria-hidden="true"></svg>
  </div>
  <canvas id="boom"></canvas><div class="flash" id="flash"></div><div class="onda" id="o1"></div><div class="onda" id="o2"></div><div class="onda" id="o3"></div>
  <svg class="sis-pr" id="pr" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"></circle></svg>
  <button class="som" id="som" type="button">SOM</button>
  <div id="logoV"><div>MOK<i>E</i>D</div><small>SIS<sup>+</sup></small></div>
  <div class="sis-hint" id="hint"></div>
  <div class="sis-dica" id="dica"></div>
  <div class="sis-info"><b>SIS⁺ · Sistema Integrado de Segurança</b></div>
  <button class="btn-entrar" id="entrar">Entrar</button>
  <div class="sis-dots" id="dots"></div>
  <div class="sis-leg"><span><i style="background:#94a3b8"></i>Equipamentos</span><span><i style="background:#7dd3fc"></i>Pessoas</span><span><i style="background:#fde68a"></i>Procedimentos</span></div>
  <div class="sis-ign" id="ign" aria-hidden="true"><div class="sis-dot"></div><div class="sis-flash"></div></div>
  <div class="card" id="card"><div class="k" id="ck"></div><h3 id="ct"></h3><p id="cd"></p><div class="lb">Alimenta no app</div><div class="chips" id="cf"></div><div class="acoes"><button id="cx">Fechar</button><button class="pri" id="ce">Entrar</button></div></div>
</div>

<div id="dive" class="dive" hidden>
  <canvas class="bg" id="bg"></canvas>
  <canvas id="cena"></canvas>
  <div class="dv-top"><div class="tabs"><button class="tab on" data-a="hist">História</button><button class="tab" data-a="univ">Universo</button></div><button class="x" id="fechar" aria-label="Voltar">✕</button></div>

  <section class="pn on" id="p-hist"><div class="rail"><i id="railp"></i></div>
    <div class="hist" id="hist">
      <div class="esp"><div class="tit"><b>História da Moked</b><span>De Israel para o Brasil</span><div class="rola" id="rola">role<i></i></div></div></div>
      <article class="cap" id="cap1">
        <div class="kk">Capítulo I · Fundação</div><div class="yr">1995</div><h2>Nasce a Moked do Brasil</h2>
        <p>Em <b>1995</b>, <b>Yehuda Carmi</b>, Tenente-Coronel das Forças Armadas de Israel, funda a Moked do Brasil: uma consultoria de segurança de <b>origem israelense</b>, com know-how e expertise em segurança.</p>
      </article>
      <article class="cap" id="cap2">
        <div class="kk">Capítulo II · Vigilância</div><div class="yr">2000</div><h2>Central 24 horas</h2>
        <p>Nasce a <b>Moked On-line</b>, a central de monitoramento 24 horas. Antes, em 1996 e 1997, a marca ganha o primeiro logotipo e a versão em preto, vermelho e branco.</p>
      </article>
      <article class="cap" id="cap3">
        <div class="kk">Capítulo III · Qualidade</div><div class="yr">2005</div><h2>Gestão certificada</h2>
        <p>Chega o selo <b>ISO 9001:2000</b>: a única consultoria de segurança do Brasil com essa certificação. Em 2010 é homologado o <b>Selo de Qualidade Moked de Segurança Internacional</b>. Hoje a gestão é certificada pelas <b>ISO 9001:2015</b> e <b>ISO 37001:2016</b> (antissuborno).</p>
      </article>
      <article class="cap" id="cap4">
        <div class="kk">Capítulo IV · Tecnologia</div><div class="yr">2007</div><h2>Tecnologia própria</h2>
        <p>Nasce a área de tecnologia interna, para criar <b>sistemas próprios e aplicativos</b> de apoio à gestão e à tomada de decisões.</p>
      </article>
      <article class="cap" id="cap5">
        <div class="kk">Capítulo V · Atuação</div><h2>Do projeto à gestão</h2>
        <p>Consultoria, projeção, gestão e DSE: a Moked concebe, projeta, implanta, opera e gere <b>Sistemas Integrados de Segurança (SIS)</b>, com foco na inteligência do sistema e na gestão de riscos e crises.</p>
        <div class="icos" id="icos"></div>
      </article>
      <article class="cap" id="cap6">
        <div class="kk">Capítulo VI · Especialização</div><h2>Cada setor pede um jeito</h2>
        <p>A mesma base ganha aplicação por vertical. Na logística, a <b>MokLog</b> usa o <b>Reverse Control®</b>: o risco é a saída irregular, e a validação sistêmica substitui a revista física.</p>
        <div class="divs">
          <div class="dv"><b><i></i>MokLog</b><span>Condomínios logísticos</span></div>
          <div class="dv"><b><i></i>MokPat</b><span>Patrimonial</span></div>
          <div class="dv"><b><i></i>MokImp</b><span>Implantação</span></div>
          <div class="dv"><b><i></i>MokVip</b><span>Pessoas e eventos</span></div>
        </div>
      </article>
      <article class="cap" id="cap7">
        <div class="kk">Capítulo VII · Agora</div><div class="yr">2026</div><h2>Moked 4.0 · Era da IA</h2>
        <p>A Moked lança a <b>Moked 4.0</b>, a Era da IA: inteligência artificial integrada à camada de inteligência generativa.</p>
      </article>
      <div class="resumo">
        <h3>Em resumo</h3>
        <p>A <b>MOKED do Brasil</b> foi fundada em <b>1995</b> por <b>Yehuda Carmi</b>, Tenente-Coronel das Forças Armadas de Israel: uma consultoria de segurança de origem israelense, com mais de três décadas de atuação.</p>
        <p>Criou a central <b>Moked On-line</b> (2000), conquistou a <b>ISO 9001</b> (2005), montou a própria área de tecnologia (2007) e hoje é certificada pelas <b>ISO 9001:2015</b> e <b>ISO 37001:2016</b>.</p>
        <p>Concebe, projeta, implanta, opera e gere <b>Sistemas Integrados de Segurança (SIS)</b> e <b>Departamentos de Segurança Empresarial (DSE)</b>, com <b>MokLog</b> para centros logísticos, <b>MokPat</b> para instalações e <b>MokVip</b> para pessoas. Em 2026, a <b>Moked 4.0</b> traz a inteligência artificial para o sistema. Tudo a serviço de uma missão:</p>
        <div class="fim">Proteger vidas e bens com eficiência e eficácia, proporcional aos riscos e ao menor custo possível.</div>
        <button class="btn-entrar btn-fim" id="entrar2" type="button">Entrar nas Áreas</button>
      </div>
    </div>
  </section>

  <section class="pn" id="p-univ"><div class="univ">
    <canvas id="uni"></canvas>
    <div class="uleg"><span><i style="background:#94a3b8"></i>Equipamentos</span><span><i style="background:#7dd3fc"></i>Pessoas</span><span><i style="background:#fde68a"></i>Procedimentos</span><span><i style="background:#ff6a70"></i>Entregas</span></div>
    <div class="ucont"><b id="ucn">0</b>módulos<br>conectados</div>
    <div class="uzoom" id="uzoom"><button type="button" data-z="in" aria-label="Aproximar">+</button><button type="button" data-z="out" aria-label="Afastar">−</button><button type="button" data-z="fit" class="t">ver tudo</button></div>
    <div class="uhint" id="uhint">arraste · aproxime com dois dedos · toque num módulo</div>
    <div class="card" id="ucard"><div class="k" id="uk"></div><h3 id="ut"></h3><p id="ud"></p><div class="lb" id="ulr">Recebe de</div><div class="chips" id="ur"></div><div class="lb" id="ula">Alimenta</div><div class="chips" id="ua"></div><div class="acoes"><button id="ux">Fechar</button></div></div>
  </div></section>
</div>
<div id="wflash"></div>
</div>
`;
