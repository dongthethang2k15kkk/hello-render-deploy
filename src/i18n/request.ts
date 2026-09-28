import {getRequestConfig} from 'next-intl/server';
import {messages} from './messages';

export default getRequestConfig(async ({requestLocale}) => {
  const locale = 'en';
  return {locale, messages: messages[locale]};
});