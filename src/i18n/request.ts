import {getRequestConfig} from 'next-intl/server';
import {messages} from './messages';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = requested === 'en' ? 'en' : 'vi';
  return {locale, messages: messages[locale]};
});