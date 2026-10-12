import CrossPromotionCore
import CrossPromotionUI
import SwiftUI

@MainActor
enum AppPromotions {
    static func makeStore() -> PromotionStore? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "CrossPromotionBaseURL") as? String,
              let url = URL(string: value), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil else { return nil }
        return PromotionStore(
            source: PromotionIdentity(appStoreID: "6768082631", bundleID: "co.relatably.app"),
            baseURL: url,
            eventsEnabled: true
        )
    }
}

@MainActor
struct AppPromotionSection: View {
    let store: PromotionStore
    let viewport: CGRect
    @Environment(\.openURL) private var openURL
    @State private var showStoreError = false

    var body: some View {
        Group {
            if !store.promotions.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.sp4) {
                    Text(String(localized: "settings.moreApps", defaultValue: "More apps"))
                        .font(.custom(Fonts.spaceGroteskSemiBold, size: 15, relativeTo: .headline))
                        .foregroundStyle(Palette.ink)
                    VStack(spacing: Spacing.sp4) { rows }
                        .padding(Spacing.sp4)
                        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
                        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 3))
                        .hardShadow(Shadows.s, shape: RoundedRectangle(cornerRadius: Radii.m))
                }
            }
        }
        .tint(Palette.ink)
        .alert(String(localized: "settings.appStoreUnavailable", defaultValue: "App Store unavailable"), isPresented: $showStoreError) {
            Button(String(localized: "common.ok", defaultValue: "OK"), role: .cancel) {}
        } message: {
            Text(String(localized: "settings.appStoreRetry", defaultValue: "Please try again in a moment."))
        }
    }

    private var rows: some View {
        ForEach(store.promotions) { promotion in
            CrossPromotionRow(
                promotion: promotion,
                appStoreActionTitle: String(localized: "settings.openAppStore", defaultValue: "View in App Store"),
                style: .init(titleFont: .custom(Fonts.hankenGroteskBold, size: 17, relativeTo: .headline), benefitFont: .custom(Fonts.hankenGroteskBold, size: 15, relativeTo: .subheadline), actionFont: .custom(Fonts.spaceGroteskSemiBold, size: 13, relativeTo: .caption), titleColor: Palette.ink, benefitColor: Palette.inkSoft)
            ) {
                CrossPromotionIcon(promotion.iconURL)
            } onSelect: { selected in
                openURL(selected.appStoreURL) { accepted in
                    if accepted { store.recordClick(selected) }
                    else { showStoreError = true }
                }
            }
            .promotionImpression(promotion, store: store, viewport: showStoreError ? .zero : viewport)
        }
    }
}
