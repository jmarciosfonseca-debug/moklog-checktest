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
  <div class="sis-hint" id="hint">Segure o dedo num ícone</div>
  <div class="sis-dica" id="dica"></div>
  <div class="sis-info"><b>SIS⁺ · Sistema Integrado de Segurança</b><span>o software por trás do hardware</span></div>
  <button class="btn-entrar" id="entrar">Entrar</button>
  <div class="sis-dots" id="dots"></div>
  <div class="sis-leg"><span><i style="background:#94a3b8"></i>Equipamentos</span><span><i style="background:#7dd3fc"></i>Pessoas</span><span><i style="background:#fde68a"></i>Procedimentos</span></div>
  <div class="sis-ign" id="ign" aria-hidden="true"><div class="sis-frase"><p>o software</p><p>por trás</p><p>do hardware</p></div><div class="sis-dot"></div><div class="sis-flash"></div></div>
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
        <div class="kk">Capítulo I · Origem</div><div class="yr">30+</div><h2>Nasce com um método</h2>
        <p>A MOKED traz uma metodologia de <b>origem israelense</b>. São <b>mais de três décadas</b> de prática aplicada à gestão de riscos, crises e prevenção de perdas.</p>
      </article>
      <article class="cap" id="cap2">
        <div class="kk">Capítulo II · Evolução</div><h2>Do projeto à operação</h2>
        <p>Começou projetando sistemas e dando apoio técnico-administrativo. Passou a gerir o que projeta: <b>Sistemas Integrados de Segurança (SIS)</b>, <b>Departamentos de Segurança Empresarial (DSE)</b>, <b>CCOs</b> e monitoramento contínuo. Da planta ao dia a dia.</p>
      </article>
      <article class="cap" id="cap3">
        <div class="kk">Capítulo III · Método</div><h2>Reverse Control®</h2>
        <p>O risco não é a invasão. É a <b>saída irregular</b>. O Reverse Control® troca a revista física por validação sistêmica. Soma-se o <b>KeyAccess</b>, no controle de acesso, e o <b>dimensionamento de efetivo</b> pelo risco real de cada operação.</p>
      </article>
      <article class="cap" id="cap4">
        <div class="kk">Capítulo IV · Especialização</div><h2>Cada setor pede um jeito</h2>
        <p><b>MokLog</b> para condomínios logísticos multiusuário. <b>MokVip</b> para pessoas e eventos. Mesma base metodológica, aplicação vertical.</p>
        <div class="divs">
          <div class="dv"><b><i></i>MokLog</b><span>Condomínios logísticos</span></div>
          <div class="dv"><b><i></i>MokPat</b><span>Patrimonial</span></div>
          <div class="dv"><b><i></i>MokImp</b><span>Implantação</span></div>
          <div class="dv"><b><i></i>MokVip</b><span>Pessoas e eventos</span></div>
        </div>
      </article>
      <article class="cap" id="cap5">
        <div class="kk">Capítulo V · Governança</div><h2>Gestão certificada</h2>
        <p><b>ISO 9001:2015</b>, de gestão da qualidade, e <b>ISO 37001:2016</b>, de gestão antissuborno. O processo é auditável por dentro e por fora.</p>
      </article>
      <article class="cap" id="cap6">
        <div class="kk">Capítulo VI · Futuro</div><h2>O software por trás do hardware</h2>
        <p>Inteligência artificial e auditoria digital entram na rotina: o dado sai do campo registrado e auditável. A lógica não muda: ser o <b>software por trás do hardware</b> da operação do cliente.</p>
        <div class="icos" id="icos"></div>
      </article>
      <div class="resumo">
        <h3>Em resumo</h3>
        <p>A <b>MOKED Security Consulting</b> (MOKED do Brasil) nasceu de um método de origem israelense: mais de três décadas aplicando, na prática, a gestão de riscos, crises e prevenção de perdas.</p>
        <p>Começou projetando sistemas e dando apoio técnico-administrativo. Hoje gere <b>Sistemas Integrados de Segurança (SIS)</b>, <b>Departamentos de Segurança Empresarial (DSE)</b>, <b>CCOs</b> e monitoramento contínuo: projeta, implanta, opera e audita.</p>
        <p>O <b>Reverse Control®</b> tira a segurança da revista física e a coloca na validação sistêmica, porque o risco não é a invasão, é a saída irregular. Soma-se o <b>KeyAccess</b>, no controle de acesso, e o dimensionamento de efetivo pelo risco real. Essa base ganha especialização por vertical: <b>MokLog</b> para logística e <b>MokVip</b> para pessoas e eventos.</p>
        <p>A gestão é certificada pelas <b>ISO 9001:2015</b> e <b>ISO 37001:2016</b>. A modernização, com inteligência artificial e auditoria digital, segue uma regra simples:</p>
        <div class="fim">Ser o software por trás do hardware da operação do cliente.</div>
        <button class="btn-entrar btn-fim" id="entrar2" type="button">Entrar nas Áreas</button>
      </div>
    </div>
  </section>

  <section class="pn" id="p-univ"><div class="univ">
    <canvas id="uni"></canvas>
    <div class="uleg"><span><i style="background:#94a3b8"></i>Equipamentos</span><span><i style="background:#7dd3fc"></i>Pessoas</span><span><i style="background:#fde68a"></i>Procedimentos</span><span><i style="background:#ff6a70"></i>Entregas</span></div>
    <div class="ucont"><b id="ucn">0</b>módulos<br>conectados</div>
    <div class="uhint" id="uhint">arraste · aproxime com dois dedos · toque num módulo</div>
    <div class="card" id="ucard"><div class="k" id="uk"></div><h3 id="ut"></h3><p id="ud"></p><div class="lb" id="ulr">Recebe de</div><div class="chips" id="ur"></div><div class="lb" id="ula">Alimenta</div><div class="chips" id="ua"></div><div class="acoes"><button id="ux">Fechar</button></div></div>
  </div></section>
</div>
<div id="wflash"></div>
</div>
`;
