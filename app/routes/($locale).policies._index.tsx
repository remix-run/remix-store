import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {Image} from '~/components/Image';

export async function loader({context}: LoaderFunctionArgs) {
  const data = await context.storefront.query(POLICIES_QUERY, {
    cache: context.storefront.CacheNone(),
  });

  const {privacyPolicy} = data.shop;

  if (!privacyPolicy) {
    throw new Response('No policies found', {status: 404});
  }

  return json({privacyPolicy});
}

export default function Policies() {
  const {privacyPolicy} = useLoaderData<typeof loader>();

  return (
    <div className="px-9 pb-12">
      <Image
        className="rounded-3xl"
        // TODO: figure out how to get this data from GraphQL
        data={{
          url: 'https://cdn.shopify.com/s/files/1/0655/4127/5819/files/privacy-banner.png?v=1719583076',
          width: 1368,
          height: 300,
          altText: '',
        }}
      />
      <div className="p-12 rounded-3xl bg-neutral-100 dark:bg-gray mt-3">
        <h1>{privacyPolicy.title}</h1>
        <div
          className="flex flex-col gap-9 pt-9 policy-container"
          dangerouslySetInnerHTML={{__html: privacyPolicy.body}}
        />
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  query PrivacyPolicy ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...Policy
      }
    }
  }
` as const;
