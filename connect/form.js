// 問い合わせフォームの切り替えと入力確認を、このページ内で行う。
(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const fieldset = form.querySelector('.contact-form-fields');
  const typeGroup = form.querySelector('.contact-type');
  const radios = [...form.querySelectorAll('input[name="category"]')];
  const panels = [...form.querySelectorAll('[data-contact-category]')];
  const textFields = [...form.querySelectorAll('input:not([type="radio"]), textarea')];
  const hint = form.querySelector('#contact-type-hint');
  const typeError = form.querySelector('#contact-type-error');
  const result = form.querySelector('#contact-result');
  const descriptions = {
    student: '参加や見学のご希望、活動について気になることなど、お気軽にご相談ください。',
    partner: '交流・登壇・共同企画など、ご相談の概要をお聞かせください。',
    other: '上の種類に当てはまらないご相談は、メッセージ欄に内容をご記入ください。',
  };

  function setTypeError(message) {
    typeError.textContent = message;
    typeGroup.toggleAttribute('data-invalid', Boolean(message));
    for (const radio of radios) {
      if (message) radio.setAttribute('aria-invalid', 'true');
      else radio.removeAttribute('aria-invalid');
    }
  }

  function updateCategory() {
    const category = radios.find(radio => radio.checked)?.value;
    for (const panel of panels) {
      const active = panel.dataset.contactCategory === category;
      panel.hidden = !active;
      panel.disabled = !active;
    }
    hint.textContent = descriptions[category] ?? '種類を選ぶと、ご相談に合った項目が表示されます。';
    setTypeError('');
    result.textContent = '';
  }

  function validate(field) {
    let message = '';
    if (field.required && !field.value.trim()) message = 'この項目を入力してください。';
    else if (field.validity.typeMismatch) message = 'メールアドレスの形式をご確認ください。';
    else if (field.maxLength >= 0 && field.value.length > field.maxLength) message = `${field.maxLength}文字以内で入力してください。`;
    const error = document.getElementById(`${field.id}-error`);
    error.textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    return !message;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = new FormData(form);
    const category = input.get('category');
    const invalid = [];
    if (!Object.hasOwn(descriptions, category)) {
      setTypeError('お問い合わせの種類を選んでください。');
      invalid.push(radios[0]);
    }
    for (const field of textFields) {
      if (field.willValidate && !validate(field)) invalid.push(field);
    }
    result.toggleAttribute('data-invalid', invalid.length > 0);
    if (invalid.length) {
      result.textContent = '入力内容に確認が必要な項目があります。';
      invalid[0].focus();
      return;
    }
    // 将来の送信処理は、この検証後の入力データを受け取る。現段階は確認結果だけを表示する。
    result.textContent = '入力形式を確認しました。受付準備中のため、内容は送信されていません。';
  });

  for (const radio of radios) radio.addEventListener('change', updateCategory);
  form.addEventListener('input', event => {
    result.textContent = '';
    if (textFields.includes(event.target) && event.target.hasAttribute('aria-invalid')) validate(event.target);
  });

  const requested = new URLSearchParams(location.search).get('type');
  for (const radio of radios) radio.checked = radio.value === requested;
  updateCategory();
  fieldset.disabled = false;
})();
